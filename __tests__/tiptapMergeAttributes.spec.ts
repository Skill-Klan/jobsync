// GHSA-cp6q-959q-f8rh: @tiptap/core's mergeAttributes() assigned an own
// `__proto__` key with bracket syntax, which swapped the merged object's
// prototype. ProseMirror's DOMSerializer enumerates attributes with for...in,
// so inherited `onerror`/`src` reached the DOM. The advisory names 3.30.4 as
// the fix; 2.27.3 carries the same one. This checks the behaviour of the
// installed @tiptap/core, whatever its version.
import { mergeAttributes } from "@tiptap/core";

describe("mergeAttributes with an own __proto__ key", () => {
  const input = JSON.parse('{"__proto__": {"src": "x", "onerror": "alert(1)"}, "class": "a"}');

  it("keeps the merged object's prototype", () => {
    expect(Object.getPrototypeOf(mergeAttributes({ class: "b" }, input))).toBe(Object.prototype);
  });

  it("lets no inherited attribute reach a for...in walk", () => {
    const merged = mergeAttributes({ class: "b" }, input);
    const inherited: string[] = [];
    for (const key in merged) {
      if (!Object.prototype.hasOwnProperty.call(merged, key)) inherited.push(key);
    }
    expect(inherited).toEqual([]);
    // The ordinary merge still works: classes are joined.
    expect(merged.class).toBe("b a");
  });
});
