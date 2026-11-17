import {test} from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../src/app/globals.css",import.meta.url),"utf8");
test("iPad widths have collapsible sidebar and backdrop",()=>{assert.match(css,/@media\(max-width:1024px\)/);assert.match(css,/\.sidebar\.open\s*\{transform:translateX\(0\)/);assert.match(css,/\.nav-backdrop\s*\{display:block/);assert.match(css,/\.nav-toggle\s*\{display:inline-flex/)});
test("phone widths are single-column with touch-sized controls",()=>{assert.match(css,/@media\(max-width:640px\)/);assert.match(css,/\.cards\s*\{grid-template-columns:1fr/);assert.match(css,/min-height:44px/)});
