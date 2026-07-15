/**
 * markupGeometry.js
 * Maps a markup rectangle from the space it was drawn in to the space it is
 * printed in.
 *
 * A markup is recorded against what the engineer saw: pdf.js display space —
 * origin top-left, y down, already rotated by the page's /Rotate entry, and
 * normalized 0-1 so it is independent of zoom. pdf-lib prints in PDF user
 * space — origin bottom-left, y up, and *unrotated*. On a rotated sheet those
 * two spaces disagree about which axis is which, so a rect has to be mapped
 * back through the rotation or it lands somewhere else entirely.
 *
 * This is the exact inverse of pdf.js's PageViewport transform, which is what
 * markupGeometry.test.mjs pins it against.
 */

/**
 * @param {{x:number,y:number,w:number,h:number}} rect - normalized display space
 * @param {{width:number,height:number}} size - unrotated page size (user space)
 * @param {number} rotation - the page's rotation in degrees
 * @returns {{x:number,y:number,width:number,height:number}} user space, for pdf-lib
 */
export function rectToUserSpace(rect, { width: W, height: H }, rotation = 0) {
  const { x, y, w, h } = rect;
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      // Display x runs along user +y; display y runs along user +x
      return { x: y * W, y: x * H, width: h * W, height: w * H };
    case 180:
      return { x: (1 - x - w) * W, y: y * H, width: w * W, height: h * H };
    case 270:
      return { x: (1 - y - h) * W, y: (1 - x - w) * H, width: h * W, height: w * H };
    default:
      // Unrotated: the axes agree, only the y origin flips
      return { x: x * W, y: (1 - y - h) * H, width: w * W, height: h * H };
  }
}
