#!/usr/bin/env node
/**
 * Dump the public shape of a TypeScript schema file as JSON.
 *
 * Walks the AST of the input file (no TS app loaded — pure compiler-API
 * walk) and emits one line of JSON to stdout: a flat
 *
 *   { "InterfaceName": { "fieldName": "tsTypeString", ... }, ... }
 *
 * map. The Python `app/tests/test_schema_drift.py` script reads this
 * and diffs it against the Pydantic-generated schema.
 *
 * Usage: node scripts/dump-schemas.mjs src/types/schemas.ts
 *
 * Implementation notes:
 *   - String-literal unions (top-level: `type X = 'a' | 'b'`) become
 *     `{ "__literal": ["a", "b"] }`.
 *   - String-literal unions used inline as a field type
 *     (`source: 'a' | 'b'`) collapse to a string-literal marker.
 *   - Interfaces that `extends` a parent flatten the parent's fields
 *     into the child so the diff against Pydantic inheritance is
 *     straightforward.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('usage: dump-schemas.mjs <file.ts>');
  process.exit(2);
}

const filePath = resolve(fileArg);
const source = readFileSync(filePath, 'utf8');
const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

const interfaces = new Map();
const literalAliasMap = new Map();

function getStringLiterals(node) {
  if (!node) return null;
  if (ts.isUnionTypeNode(node)) {
    const lits = node.types
      .filter(ts.isLiteralTypeNode)
      .map((lt) => lt.literal.getText(sf).replace(/^['"]|['"]$/g, ''));
    if (lits.length === node.types.length && lits.length > 0) return lits;
  }
  return null;
}

function typeToKind(node) {
  if (!node) return 'unknown';
  const lits = getStringLiterals(node);
  if (lits) {
    // If this literal union matches a top-level type alias, emit the
    // alias name so it round-trips against a Pydantic Literal alias
    // reference (e.g. `stage: PipelineStage` ↔ `stage: Literal[...]`).
    const alias = literalAliasMap.get(lits.slice().sort().join('|'));
    if (alias) return alias;
    return { __literal: lits };
  }
  if (ts.isUnionTypeNode(node)) {
    // Non-literal union — keep as a pipe-joined string for the diff.
    return node.types.map((t) => typeToKind(t)).join(' | ');
  }
  if (ts.isArrayTypeNode(node)) {
    return `${typeToKind(node.elementType)}[]`;
  }
  if (ts.isTupleTypeNode(node)) {
    return '[' + node.elements.map((e) => typeToKind(e)).join(', ') + ']';
  }
  if (ts.isParenthesizedTypeNode(node)) {
    return typeToKind(node.type);
  }
  if (ts.isTypeReferenceNode(node)) {
    return node.typeName.getText(sf);
  }
  if (ts.isLiteralTypeNode(node)) {
    return node.literal.getText(sf).replace(/^['"]|['"]$/g, '');
  }
  if (node.kind === ts.SyntaxKind.StringKeyword) return 'string';
  if (node.kind === ts.SyntaxKind.NumberKeyword) return 'number';
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return 'boolean';
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) return 'null';
  if (node.kind === ts.SyntaxKind.AnyKeyword) return 'any';
  if (node.kind === ts.SyntaxKind.UnknownKeyword) return 'unknown';
  if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) return 'function';
  return node.getText(sf).trim();
}

function collectInterface(name, decl) {
  const fields = {};
  // Inherit from extends clauses (single-level flatten is enough for
  // the project's actual inheritance — ResolvedItem extends DetectedItem).
  const parents = (decl.heritageClauses ?? []).flatMap((c) => c.types);
  for (const parent of parents) {
    const parentName = parent.expression.getText(sf);
    const parentDecl = interfaces.get(parentName);
    if (parentDecl) {
      Object.assign(fields, parentDecl);
    }
  }
  for (const member of decl.members) {
    if (ts.isPropertySignature(member) && member.name) {
      const fieldName = member.name.getText(sf);
      const typeNode = member.type ?? ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
      fields[fieldName] = typeToKind(typeNode);
    }
  }
  return fields;
}

// First pass: index top-level string-literal type aliases so inline
// unions with matching values can be re-written to the alias name
// (e.g. `stage: 'a' | 'b'` → `PipelineStage` when the alias `PipelineStage`
// has the same literal set).
for (const stmt of sf.statements) {
  if (ts.isTypeAliasDeclaration(stmt) && ts.isUnionTypeNode(stmt.type)) {
    const lits = getStringLiterals(stmt.type);
    if (lits) {
      literalAliasMap.set(lits.slice().sort().join('|'), stmt.name.text);
    }
  }
}

for (const stmt of sf.statements) {
  if (ts.isInterfaceDeclaration(stmt)) {
    const name = stmt.name.text;
    const fields = collectInterface(name, stmt);
    interfaces.set(name, fields);
  }
}

const out = {};
for (const [name, fields] of interfaces.entries()) {
  out[name] = fields;
}

for (const stmt of sf.statements) {
  if (ts.isTypeAliasDeclaration(stmt) && ts.isUnionTypeNode(stmt.type)) {
    const lits = getStringLiterals(stmt.type);
    if (lits) {
      out[stmt.name.text] = { __literal: lits };
    }
  }
}

process.stdout.write(JSON.stringify(out));
