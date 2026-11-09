import test from "node:test";
import assert from "node:assert/strict";

import { $, esc, icon } from "../js/shared/utils/dom.js";

test("DOM utils: esc correctly sanitizes HTML characters and handles types", () => {
  assert.equal(esc("Hello World"), "Hello World");
  assert.equal(esc("AT&T"), "AT&amp;T");
  assert.equal(esc("<script>alert('xss')</script>"), "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  assert.equal(esc('"Quotes" & \'Single\''), "&quot;Quotes&quot; &amp; &#39;Single&#39;");
  assert.equal(esc(123), "123");
  assert.equal(esc(false), "false");
});

test("DOM utils: icon generates correct SVG sprite markup", () => {
  assert.equal(
    icon("check"),
    `<svg class="i " aria-hidden="true"><use href="#i-check"/></svg>`
  );

  assert.equal(
    icon("trash", "del-btn-icon"),
    `<svg class="i del-btn-icon" aria-hidden="true"><use href="#i-trash"/></svg>`
  );
});

test("DOM utils: $ safely handles environment without throwing", () => {
  if (typeof document === "undefined") {
    assert.equal($("nonexistent"), null);
  } else {
    const el = $("nonexistent-element-id-12345");
    assert.equal(el, null);
  }
});
