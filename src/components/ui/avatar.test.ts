import { describe, expect, it } from "vitest";
import { avatarSrc } from "./avatar";

/*
 * The property that matters: a 32px circle must not download an 800px JPEG.
 * Measured on the landing page before this existed — 807 KB of avatars in a
 * 1,098 KB page, at 135 KB per coin against 10 KB for the size actually drawn.
 */
describe("avatarSrc", () => {
  const google =
    "https://yt3.ggpht.com/BvNmNqOf_sZYepem=s800-c-k-c0x00ffffff-no-rj";

  it("asks the CDN for twice the rendered edge, not whatever it was given", () => {
    expect(avatarSrc(google, "sm")).toContain("=s64-c-k-");
    expect(avatarSrc(google, "lg")).toContain("=s112-c-k-");
    expect(avatarSrc(google, "2xl")).toContain("=s192-c-k-");
  });

  it("keeps the rest of the path intact", () => {
    expect(avatarSrc(google, "md")).toBe(
      "https://yt3.ggpht.com/BvNmNqOf_sZYepem=s80-c-k-c0x00ffffff-no-rj",
    );
  });

  it("rewrites a size that ends the URL", () => {
    expect(avatarSrc("https://yt3.ggpht.com/abc=s800", "sm")).toBe(
      "https://yt3.ggpht.com/abc=s64",
    );
  });

  it("leaves a CDN that does not use the convention alone", () => {
    const instagram = "https://scontent.cdninstagram.com/v/t51.2885-19/abc.jpg";
    expect(avatarSrc(instagram, "lg")).toBe(instagram);
  });
});
