import { describe, expect, it } from "vitest";
import {
  adapterType,
  createServerAdapter,
  ollamaAdapter
} from "./index.js";

describe("root package exports", () => {
  it("exports createServerAdapter for Paperclip plugin installation", () => {
    expect(typeof createServerAdapter).toBe("function");
    expect(createServerAdapter()).toBe(ollamaAdapter);
    expect(createServerAdapter().type).toBe(adapterType);
  });
});
