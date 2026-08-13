import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import JavaScriptObfuscator from 'javascript-obfuscator'
import { obfuscatorOptions } from '../obfuscator.options.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const panelPath = resolve(root, 'dist/panel/panel.js')

if (!existsSync(panelPath)) {
  console.error('[obfuscate-panel] No existe dist/panel/panel.js — corre vite build primero.')
  process.exit(1)
}

const source = readFileSync(panelPath, 'utf8')
const result = JavaScriptObfuscator.obfuscate(source, obfuscatorOptions)
writeFileSync(panelPath, result.getObfuscatedCode(), 'utf8')
console.log('[obfuscate-panel] Ofuscado:', panelPath)
