import { addIcon } from '@iconify/react';

/**
 * The full-colour EvoCloud brand mark, reproduced exactly as supplied by brand.
 *
 * Its fills are hardcoded (`#006cfd`, `#fdb900`, `#fff`) and it carries seven
 * drop-shadow filters, so it will NOT inherit the surrounding text colour and it
 * turns to mush below roughly 32px. Use it for splash art, page headers, and
 * about dialogs — never for sidebar or toolbar chrome.
 */
export const EVOCLOUD_ICON_FULL_COLOR = 'custom:evocloud-color';

addIcon(EVOCLOUD_ICON_FULL_COLOR, {
  body: "<defs>\n    <style>\n      .evocloud-cls-1 {\n        fill: #006cfd;\n      }\n\n      .evocloud-cls-2 {\n        filter: url(#evocloud-ds-2);\n      }\n\n      .evocloud-cls-3 {\n        fill: #fdb900;\n      }\n\n      .evocloud-cls-4 {\n        filter: url(#evocloud-ds-6);\n      }\n\n      .evocloud-cls-5 {\n        fill: #023fff;\n      }\n\n      .evocloud-cls-6 {\n        filter: url(#evocloud-ds-5);\n      }\n\n      .evocloud-cls-7 {\n        fill: #fff;\n      }\n\n      .evocloud-cls-8 {\n        filter: url(#evocloud-ds-4);\n      }\n\n      .evocloud-cls-9 {\n        filter: url(#evocloud-ds-7);\n      }\n\n      .evocloud-cls-10 {\n        filter: url(#evocloud-ds-1);\n      }\n\n      .evocloud-cls-11 {\n        fill: #013ffd;\n      }\n\n      .evocloud-cls-12 {\n        filter: url(#evocloud-ds-3);\n      }\n\n      .evocloud-cls-13 {\n        fill: none;\n        stroke: #023fff;\n        stroke-miterlimit: 10;\n        stroke-width: .75px;\n      }\n    </style>\n    <filter id=\"evocloud-ds-1\" x=\"44.99\" y=\"6.48\" width=\"420.67\" height=\"500.27\" filterUnits=\"userSpaceOnUse\">\n      <feOffset dx=\"1\" dy=\"-1\"/>\n      <feGaussianBlur result=\"blur\" stdDeviation=\"0\"/>\n      <feFlood flood-color=\"#000\" flood-opacity=\".1\"/>\n      <feComposite in2=\"blur\" operator=\"in\"/>\n      <feComposite in=\"SourceGraphic\"/>\n    </filter>\n    <filter id=\"evocloud-ds-2\" x=\"53.28\" y=\"21.84\" width=\"399.12\" height=\"472.56\" filterUnits=\"userSpaceOnUse\">\n      <feOffset dx=\"-2\" dy=\"1\"/>\n      <feGaussianBlur result=\"blur-2\" stdDeviation=\"2\"/>\n      <feFlood flood-color=\"#000\" flood-opacity=\".1\"/>\n      <feComposite in2=\"blur-2\" operator=\"in\"/>\n      <feComposite in=\"SourceGraphic\"/>\n    </filter>\n    <filter id=\"evocloud-ds-3\" x=\"70.08\" y=\"42\" width=\"365.28\" height=\"432.24\" filterUnits=\"userSpaceOnUse\">\n      <feOffset dx=\"-2\" dy=\"1\"/>\n      <feGaussianBlur result=\"blur-3\" stdDeviation=\"2\"/>\n      <feFlood flood-color=\"#000\" flood-opacity=\".1\"/>\n      <feComposite in2=\"blur-3\" operator=\"in\"/>\n      <feComposite in=\"SourceGraphic\"/>\n    </filter>\n    <filter id=\"evocloud-ds-4\" x=\"94.49\" y=\"65.37\" width=\"321.68\" height=\"382.5\" filterUnits=\"userSpaceOnUse\">\n      <feOffset dx=\"1\" dy=\"-1\"/>\n      <feGaussianBlur result=\"blur-4\" stdDeviation=\"0\"/>\n      <feFlood flood-color=\"#000\" flood-opacity=\".1\"/>\n      <feComposite in2=\"blur-4\" operator=\"in\"/>\n      <feComposite in=\"SourceGraphic\"/>\n    </filter>\n    <filter id=\"evocloud-ds-5\" x=\"168.4\" y=\"287.8\" width=\"177.94\" height=\"51.46\" filterUnits=\"userSpaceOnUse\">\n      <feOffset dx=\"1\" dy=\"1\"/>\n      <feGaussianBlur result=\"blur-5\" stdDeviation=\"0\"/>\n      <feFlood flood-color=\"#000\" flood-opacity=\".1\"/>\n      <feComposite in2=\"blur-5\" operator=\"in\"/>\n      <feComposite in=\"SourceGraphic\"/>\n    </filter>\n    <filter id=\"evocloud-ds-6\" x=\"168.4\" y=\"229.57\" width=\"177.94\" height=\"51.44\" filterUnits=\"userSpaceOnUse\">\n      <feOffset dx=\"1\" dy=\"1\"/>\n      <feGaussianBlur result=\"blur-6\" stdDeviation=\"0\"/>\n      <feFlood flood-color=\"#000\" flood-opacity=\".1\"/>\n      <feComposite in2=\"blur-6\" operator=\"in\"/>\n      <feComposite in=\"SourceGraphic\"/>\n    </filter>\n    <filter id=\"evocloud-ds-7\" x=\"168.4\" y=\"171.71\" width=\"177.94\" height=\"51.44\" filterUnits=\"userSpaceOnUse\">\n      <feOffset dx=\"1\" dy=\"1\"/>\n      <feGaussianBlur result=\"blur-7\" stdDeviation=\"0\"/>\n      <feFlood flood-color=\"#000\" flood-opacity=\".1\"/>\n      <feComposite in2=\"blur-7\" operator=\"in\"/>\n      <feComposite in=\"SourceGraphic\"/>\n    </filter>\n  </defs>\n  <path class=\"evocloud-cls-5\" d=\"M256,3.53C116.82,3.53,3.53,116.82,3.53,256s113.29,252.47,252.47,252.47,252.47-113.29,252.47-252.47S395.56,3.53,256,3.53Z\"/>\n  <g class=\"evocloud-cls-10\">\n    <path class=\"evocloud-cls-3\" d=\"M464.66,123.34l-6.25,64.6-3.8,53.55-4.82,33.56c-2.31,16.07-6.11,31.89-11.36,47.25h0c-6.11,17.89-14.15,35.07-23.98,51.22l-9.81,16.12c-17.13,26.1-51.26,48.69-51.26,48.69l-99.6,68.42-73.77-49.18-40.84-32.89c-14.1-11.36-26.53-24.65-36.93-39.48l-8.79-12.54c-8.95-12.77-16.38-26.55-22.13-41.04h0c-7.22-18.18-11.73-37.32-13.39-56.81l-12.95-151.48L253.78,7.48l210.88,115.86Z\"/>\n  </g>\n  <g class=\"evocloud-cls-2\">\n    <path class=\"evocloud-cls-7\" d=\"M448.33,133.75l-5.76,59.57-3.5,49.39-4.45,30.95c-2.13,14.82-5.64,29.41-10.48,43.57h0c-5.64,16.5-13.05,32.34-22.11,47.23l-9.04,14.87c-15.8,24.07-47.27,44.9-47.27,44.9l-91.85,63.1-68.03-45.35-37.66-30.33c-13.01-10.47-24.47-22.73-34.05-36.41l-8.1-11.56c-8.25-11.78-15.1-24.48-20.41-37.85h0c-6.65-16.76-10.82-34.41-12.35-52.39l-11.95-139.7L253.86,26.91l194.47,106.84Z\"/>\n  </g>\n  <g class=\"evocloud-cls-12\">\n    <path class=\"evocloud-cls-5\" d=\"M431.33,144.59l-5.26,54.34-3.19,45.05-4.06,28.23c-1.94,13.52-5.14,26.82-9.56,39.75h0c-5.14,15.05-11.9,29.5-20.17,43.08l-8.25,13.56c-14.41,21.95-43.12,40.96-43.12,40.96l-83.78,57.55-62.05-41.37-34.35-27.66c-11.86-9.55-22.32-20.73-31.06-33.21l-7.39-10.55c-7.53-10.74-13.78-22.33-18.62-34.53h0c-6.07-15.29-9.87-31.39-11.27-47.78l-10.9-127.42L253.95,47.13l177.38,97.46Z\"/>\n  </g>\n  <g class=\"evocloud-cls-8\">\n    <path id=\"WhiteShield\" class=\"evocloud-cls-7\" d=\"M415.16,154.9l-4.78,49.36-2.9,40.92-3.68,25.65c-1.76,12.28-4.67,24.37-8.68,36.1h0c-4.67,13.67-10.81,26.79-18.32,39.14l-7.49,12.32c-13.09,19.94-39.17,37.2-39.17,37.2l-76.11,52.28-56.37-37.58-31.2-25.13c-10.78-8.68-20.28-18.83-28.22-30.17l-6.71-9.58c-6.84-9.76-12.51-20.29-16.91-31.36h0c-5.51-13.89-8.96-28.52-10.23-43.41l-9.9-115.75,159.54-88.53,161.13,88.53Z\"/>\n  </g>\n  <path id=\"Links\" class=\"evocloud-cls-13\" d=\"M138.77,146.22c0,4.51-3.75,7.91-8.26,7.91s-7.91-3.78-7.91-8.29,3.78-7.88,8.29-7.88,7.88,3.75,7.88,8.26ZM200.74,114.66c4.51,0,8.26-3.37,8.26-7.88s-3.37-8.26-7.88-8.26-8.26,3.37-8.26,7.88c0,1.51.38,2.93,1.04,4.16l-56.27,31.14,56.27-31.14c1.36,2.43,3.85,4.1,6.84,4.1ZM283.42,405.7c-1.36-2.43-3.84-4.1-6.84-4.1-4.51,0-8.26,3.37-8.26,7.88s3.37,8.26,7.88,8.26,8.26-3.37,8.26-7.88c0-1.51-.38-2.93-1.04-4.16l48.86-33.56M212.17,420.94l74.21-48.79M190.28,137.35l101.27-58.54M352.45,113.45l-38.44,23.9\"/>\n  <g>\n    <path class=\"evocloud-cls-3\" d=\"M338.97,148.33h-161.22c-3.09,0-5.75.42-7.68,2.66-1.15,1.34-1.67,3.11-1.67,4.87v9.16h178.43v-11.12c0-3.07-2.48-5.56-5.54-5.57h-.07c-.73,0-1.47,0-2.24,0Z\"/>\n    <path class=\"evocloud-cls-1\" d=\"M359.98,147.6c-.56-1.64-1.35-3.21-2.43-4.57-2.95-3.7-4.82-6.5-10.49-9.23-1.69-.67-.69-.45-2.83-.67h-168.41c-4.45,0-8.53,1.11-12.24,3.71-1.48,1.11-2.97,2.23-4.08,3.71-4.08,4.08-5.94,8.9-6.31,14.84v15.21h15.21v-14.74c0-1.76.52-3.52,1.66-4.86,1.91-2.24,4.56-2.66,7.62-2.66h162.11c2.23,0,4.08,1.11,5.56,2.6.15.15.28.31.4.48.77,1.1,1.08,2.46,1.08,3.8v15.38s14.84,0,14.84,0v-16.69c0-2.15-.77-3.84-1.41-5.56-.09-.24-.18-.49-.26-.73Z\"/>\n  </g>\n  <g>\n    <path class=\"evocloud-cls-3\" d=\"M166.17,358.28c.77,1.19,1.11,1.46,1.85,2.04,1.48,1.17,3.34,2.05,5.56,2.05h162.11c2.17,0,4.07-.22,5.63-.84.1-.04.2-.08.29-.13.15-.07.3-.15.44-.23,1.18-.66,2.16-1.66,2.91-3.18v-13.15h-178.8v13.44s0,0,0,0Z\"/>\n    <path class=\"evocloud-cls-1\" d=\"M344.97,340.11h0v14.69c0,1.84-.56,3.69-1.8,5.05-.35.38-.72.71-1.11.99-.15.1-.29.2-.44.29-.1.06-.2.11-.29.17-1.61.86-3.52,1.06-5.63,1.06h-162.11c-2.23,0-4.08-1.11-5.56-2.6-.74-.74-1-.68-1.85-2.6,0,0,0,0,0,0h0v-17.06h-14.84v14.84c0,2.69.41,5.11,1.31,7.42.59,1.51,1.37,2.98,2.4,4.45,1.11,1.85,2.6,2.97,3.71,4.45,4.08,4.08,8.9,5.94,14.84,5.94h163.59c4.45,0,8.53-1.11,12.24-3.71,1.85-1.11,3.34-2.97,4.82-4.45,2.6-2.23,3.71-5.56,4.82-8.53.74-1.48.37-3.34.74-4.82v-12.24c0-4.08,0-2.23,0-3.34h-14.84Z\"/>\n  </g>\n  <g>\n    <rect class=\"evocloud-cls-11\" x=\"175.74\" y=\"280.02\" width=\"161.89\" height=\"7.79\"/>\n    <rect class=\"evocloud-cls-11\" x=\"175.74\" y=\"222.15\" width=\"161.89\" height=\"7.79\"/>\n    <g class=\"evocloud-cls-6\">\n      <path class=\"evocloud-cls-11\" d=\"M168.4,287.8v50.46h176.94v-50.46h-176.94ZM328.45,304.87h-72.68v-4.08h72.68v4.08ZM328.45,316h-72.68v-4.08h72.68v4.08ZM328.45,327.13h-72.68v-4.08h72.68v4.08ZM213.55,317.49c-2.21,0-4.04-1.49-4.04-3.34s1.83-3.34,4.04-3.34,4.04,1.49,4.04,3.34-1.85,3.34-4.04,3.34ZM192.26,317.85c-2.64,0-4.78-1.65-4.78-3.7s2.14-3.72,4.78-3.72,4.76,1.67,4.76,3.72-2.13,3.7-4.76,3.7Z\"/>\n    </g>\n    <g class=\"evocloud-cls-4\">\n      <path class=\"evocloud-cls-11\" d=\"M168.4,229.57v50.44h176.94v-50.44h-176.94ZM328.45,268.88h-72.68v-4.07h72.68v4.07ZM328.45,257.75h-72.68v-4.07h72.68v4.07ZM328.45,246.62h-72.68v-4.07h72.68v4.07ZM213.55,259.24c-2.21,0-4.04-1.49-4.04-3.34s1.83-3.34,4.04-3.34,4.04,1.49,4.04,3.34-1.85,3.34-4.04,3.34ZM192.26,259.61c-2.64,0-4.78-1.65-4.78-3.7s2.14-3.7,4.78-3.7,4.76,1.65,4.76,3.7-2.13,3.7-4.76,3.7Z\"/>\n    </g>\n    <g class=\"evocloud-cls-9\">\n      <path class=\"evocloud-cls-11\" d=\"M168.4,171.71v50.44h176.94v-50.44h-176.94ZM328.45,188.76h-72.68v-4.07h72.68v4.07ZM328.45,199.52h-72.68v-4.08h72.68v4.08ZM328.45,210.65h-72.68v-4.08h72.68v4.08ZM213.55,201.01c-2.21,0-4.04-1.49-4.04-3.34s1.83-3.34,4.04-3.34,4.04,1.49,4.04,3.34-1.85,3.34-4.04,3.34ZM191.88,201.38c-2.57,0-4.76-1.85-4.76-3.7s2.19-3.72,4.76-3.72,4.78,1.87,4.78,3.72c0,2.22-2.21,3.7-4.78,3.7Z\"/>\n    </g>\n  </g>",
  width: 512,
  height: 512,
});

/*
 * Outlines lifted verbatim from the master artwork (`ICON-COLOR.svg`) so the
 * monochrome glyphs below are the real mark with the palette removed, rather
 * than a redrawn approximation. Naming follows the source's paint order.
 *
 * The mark nests four shields: gold outer, white, blue, white. What the eye
 * reads is the two *gaps* between them — a gold band and a blue band — so each
 * band is reproduced as an outer/inner path pair combined under `evenodd`.
 */
const SHIELD_GOLD_OUTER =
  'M464.66,123.34l-6.25,64.6-3.8,53.55-4.82,33.56c-2.31,16.07-6.11,31.89-11.36,47.25h0c-6.11,17.89-14.15,35.07-23.98,51.22l-9.81,16.12c-17.13,26.1-51.26,48.69-51.26,48.69l-99.6,68.42-73.77-49.18-40.84-32.89c-14.1-11.36-26.53-24.65-36.93-39.48l-8.79-12.54c-8.95-12.77-16.38-26.55-22.13-41.04h0c-7.22-18.18-11.73-37.32-13.39-56.81l-12.95-151.48L253.78,7.48l210.88,115.86Z';
const SHIELD_GOLD_INNER =
  'M448.33,133.75l-5.76,59.57-3.5,49.39-4.45,30.95c-2.13,14.82-5.64,29.41-10.48,43.57h0c-5.64,16.5-13.05,32.34-22.11,47.23l-9.04,14.87c-15.8,24.07-47.27,44.9-47.27,44.9l-91.85,63.1-68.03-45.35-37.66-30.33c-13.01-10.47-24.47-22.73-34.05-36.41l-8.1-11.56c-8.25-11.78-15.1-24.48-20.41-37.85h0c-6.65-16.76-10.82-34.41-12.35-52.39l-11.95-139.7L253.86,26.91l194.47,106.84Z';
const SHIELD_BLUE_OUTER =
  'M431.33,144.59l-5.26,54.34-3.19,45.05-4.06,28.23c-1.94,13.52-5.14,26.82-9.56,39.75h0c-5.14,15.05-11.9,29.5-20.17,43.08l-8.25,13.56c-14.41,21.95-43.12,40.96-43.12,40.96l-83.78,57.55-62.05-41.37-34.35-27.66c-11.86-9.55-22.32-20.73-31.06-33.21l-7.39-10.55c-7.53-10.74-13.78-22.33-18.62-34.53h0c-6.07-15.29-9.87-31.39-11.27-47.78l-10.9-127.42L253.95,47.13l177.38,97.46Z';
const SHIELD_BLUE_INNER =
  'M415.16,154.9l-4.78,49.36-2.9,40.92-3.68,25.65c-1.76,12.28-4.67,24.37-8.68,36.1h0c-4.67,13.67-10.81,26.79-18.32,39.14l-7.49,12.32c-13.09,19.94-39.17,37.2-39.17,37.2l-76.11,52.28-56.37-37.58-31.2-25.13c-10.78-8.68-20.28-18.83-28.22-30.17l-6.71-9.58c-6.84-9.76-12.51-20.29-16.91-31.36h0c-5.51-13.89-8.96-28.52-10.23-43.41l-9.9-115.75,159.54-88.53,161.13,88.53Z';

/* Rack clamps. Each is a gold inlay sitting inside a blue bracket; painted in
 * one colour they union into a single capsule, so they stay as separate paths
 * (merging them into one `d` would let the opposing windings punch holes). */
const CLAMP_TOP_INLAY =
  'M338.97,148.33h-161.22c-3.09,0-5.75.42-7.68,2.66-1.15,1.34-1.67,3.11-1.67,4.87v9.16h178.43v-11.12c0-3.07-2.48-5.56-5.54-5.57h-.07c-.73,0-1.47,0-2.24,0Z';
const CLAMP_TOP_BRACKET =
  'M359.98,147.6c-.56-1.64-1.35-3.21-2.43-4.57-2.95-3.7-4.82-6.5-10.49-9.23-1.69-.67-.69-.45-2.83-.67h-168.41c-4.45,0-8.53,1.11-12.24,3.71-1.48,1.11-2.97,2.23-4.08,3.71-4.08,4.08-5.94,8.9-6.31,14.84v15.21h15.21v-14.74c0-1.76.52-3.52,1.66-4.86,1.91-2.24,4.56-2.66,7.62-2.66h162.11c2.23,0,4.08,1.11,5.56,2.6.15.15.28.31.4.48.77,1.1,1.08,2.46,1.08,3.8v15.38s14.84,0,14.84,0v-16.69c0-2.15-.77-3.84-1.41-5.56-.09-.24-.18-.49-.26-.73Z';
const CLAMP_BOTTOM_INLAY =
  'M166.17,358.28c.77,1.19,1.11,1.46,1.85,2.04,1.48,1.17,3.34,2.05,5.56,2.05h162.11c2.17,0,4.07-.22,5.63-.84.1-.04.2-.08.29-.13.15-.07.3-.15.44-.23,1.18-.66,2.16-1.66,2.91-3.18v-13.15h-178.8v13.44s0,0,0,0Z';
const CLAMP_BOTTOM_BRACKET =
  'M344.97,340.11h0v14.69c0,1.84-.56,3.69-1.8,5.05-.35.38-.72.71-1.11.99-.15.1-.29.2-.44.29-.1.06-.2.11-.29.17-1.61.86-3.52,1.06-5.63,1.06h-162.11c-2.23,0-4.08-1.11-5.56-2.6-.74-.74-1-.68-1.85-2.6,0,0,0,0,0,0h0v-17.06h-14.84v14.84c0,2.69.41,5.11,1.31,7.42.59,1.51,1.37,2.98,2.4,4.45,1.11,1.85,2.6,2.97,3.71,4.45,4.08,4.08,8.9,5.94,14.84,5.94h163.59c4.45,0,8.53-1.11,12.24-3.71,1.85-1.11,3.34-2.97,4.82-4.45,2.6-2.23,3.71-5.56,4.82-8.53.74-1.48.37-3.34.74-4.82v-12.24c0-4.08,0-2.23,0-3.34h-14.84Z';

/* The three rack units. Each source path already knocks its own status dots and
 * text lines out of the unit body by reversing their winding, so they carry
 * their detail under the default nonzero rule with no extra work. */
const RACK_UNIT_1 =
  'M168.4,171.71v50.44h176.94v-50.44h-176.94ZM328.45,188.76h-72.68v-4.07h72.68v4.07ZM328.45,199.52h-72.68v-4.08h72.68v4.08ZM328.45,210.65h-72.68v-4.08h72.68v4.08ZM213.55,201.01c-2.21,0-4.04-1.49-4.04-3.34s1.83-3.34,4.04-3.34,4.04,1.49,4.04,3.34-1.85,3.34-4.04,3.34ZM191.88,201.38c-2.57,0-4.76-1.85-4.76-3.7s2.19-3.72,4.76-3.72,4.78,1.87,4.78,3.72c0,2.22-2.21,3.7-4.78,3.7Z';
const RACK_UNIT_2 =
  'M168.4,229.57v50.44h176.94v-50.44h-176.94ZM328.45,268.88h-72.68v-4.07h72.68v4.07ZM328.45,257.75h-72.68v-4.07h72.68v4.07ZM328.45,246.62h-72.68v-4.07h72.68v4.07ZM213.55,259.24c-2.21,0-4.04-1.49-4.04-3.34s1.83-3.34,4.04-3.34,4.04,1.49,4.04,3.34-1.85,3.34-4.04,3.34ZM192.26,259.61c-2.64,0-4.78-1.65-4.78-3.7s2.14-3.7,4.78-3.7,4.76,1.65,4.76,3.7-2.13,3.7-4.76,3.7Z';
const RACK_UNIT_3 =
  'M168.4,287.8v50.46h176.94v-50.46h-176.94ZM328.45,304.87h-72.68v-4.08h72.68v4.08ZM328.45,316h-72.68v-4.08h72.68v4.08ZM328.45,327.13h-72.68v-4.08h72.68v4.08ZM213.55,317.49c-2.21,0-4.04-1.49-4.04-3.34s1.83-3.34,4.04-3.34,4.04,1.49,4.04,3.34-1.85,3.34-4.04,3.34ZM192.26,317.85c-2.64,0-4.78-1.65-4.78-3.7s2.14-3.72,4.78-3.72,4.76,1.67,4.76,3.72-2.13,3.7-4.76,3.7Z';
/** Inset spacers bridging the rack units, notched clear of the unit edges. */
const RACK_SPACERS = 'M175.74,222.15h161.89v7.79h-161.89zM175.74,280.02h161.89v7.79h-161.89z';
/** Circuit traces and their terminal nodes, drifting behind the shield. */
const CIRCUIT_TRACES =
  'M138.77,146.22c0,4.51-3.75,7.91-8.26,7.91s-7.91-3.78-7.91-8.29,3.78-7.88,8.29-7.88,7.88,3.75,7.88,8.26ZM200.74,114.66c4.51,0,8.26-3.37,8.26-7.88s-3.37-8.26-7.88-8.26-8.26,3.37-8.26,7.88c0,1.51.38,2.93,1.04,4.16l-56.27,31.14,56.27-31.14c1.36,2.43,3.85,4.1,6.84,4.1ZM283.42,405.7c-1.36-2.43-3.84-4.1-6.84-4.1-4.51,0-8.26,3.37-8.26,7.88s3.37,8.26,7.88,8.26,8.26-3.37,8.26-7.88c0-1.51-.38-2.93-1.04-4.16l48.86-33.56M212.17,420.94l74.21-48.79M190.28,137.35l101.27-58.54M352.45,113.45l-38.44,23.9';

/**
 * Monochrome EvoCloud mark, drawn from the source geometry above.
 *
 * Every element is `currentColor`, so it inherits `sidebar.color` when idle and
 * `sidebar.selectedColor` when active, like the stock `mdi:*` icons beside it.
 * Structurally it is the full mark: outer ring, gold band, blue band, both rack
 * clamps, and all three rack units with their status dots and text lines
 * intact. Only two things change, and neither is a simplification of shape:
 *
 *  - The circle becomes a ring rather than the source's solid disc. Filled in a
 *    single colour it would swallow everything inside it.
 *  - Colour-only separation becomes gaps. Where the artwork distinguishes two
 *    touching shapes by hue, monochrome needs real space between them, which
 *    the shields already have and the clamps inherit from their brackets.
 *
 * Legibility ceiling: the rack's text lines are 4 units on a 512 grid, so they
 * resolve from roughly 32px up and turn to grey haze below that. Prefer
 * {@link EVOCLOUD_ICON_COMPACT} for 16–24px chrome.
 */
export const EVOCLOUD_ICON = 'custom:evocloud';

addIcon(EVOCLOUD_ICON, {
  body: `<circle cx="256" cy="256" r="239.5" fill="none" stroke="currentColor" stroke-width="25.9"/>
  <path fill="none" stroke="currentColor" stroke-width="5" d="${CIRCUIT_TRACES}"/>
  <path fill="currentColor" fill-rule="evenodd" d="${SHIELD_GOLD_OUTER}${SHIELD_GOLD_INNER}"/>
  <path fill="currentColor" fill-rule="evenodd" d="${SHIELD_BLUE_OUTER}${SHIELD_BLUE_INNER}"/>
  <path fill="currentColor" d="${CLAMP_TOP_BRACKET}"/>
  <path fill="currentColor" d="${CLAMP_TOP_INLAY}"/>
  <path fill="currentColor" d="${CLAMP_BOTTOM_BRACKET}"/>
  <path fill="currentColor" d="${CLAMP_BOTTOM_INLAY}"/>
  <path fill="currentColor" d="${RACK_UNIT_1}"/>
  <path fill="currentColor" d="${RACK_UNIT_2}"/>
  <path fill="currentColor" d="${RACK_UNIT_3}"/>
  <path fill="currentColor" d="${RACK_SPACERS}"/>`,
  width: 512,
  height: 512,
});

/**
 * EvoCloud glyph at optical size 20 — the size Headlamp's sidebar actually
 * renders (`ExpandedIconSize` in `Sidebar/ListItemLink.js`; collapsed is 24).
 *
 * This is a separate optical size, not a scaled copy of {@link EVOCLOUD_ICON},
 * for the same reason type families cut separate display and text weights: at
 * 20px one CSS pixel is 25.6 units on the 512 grid, so every feature has to be
 * ~26 units to survive at all and ~31 to look deliberate. Detail is not lost
 * gracefully at that size, it turns to grey haze, so the budget is spent
 * explicitly:
 *
 *  - Ring and shield band both 32 units (1.25px), the heaviest the composition
 *    can carry without the counters closing up.
 *  - One shield band, not the mark's two. Ring plus two bands plus rack is five
 *    concentric strokes across the radius; at 20px they alias into a moiré.
 *    What that saves is spent keeping the band at full weight rather than
 *    rendering two of them at half.
 *  - The shield is stroked rather than reproduced as an outer/inner path pair.
 *    A centred stroke *is* the band, and it stays one tunable number.
 *  - The rack keeps its clamps. The capped silhouette is what distinguishes
 *    this mark from a generic shield; three bare bars, which is what the
 *    previous reduction had, is not recognisably EvoCloud.
 *  - Rack pitch is re-cut to 35-unit units and 22-unit gaps against the
 *    source's 50 and 8, holding units at 1.09px and gaps at 0.69px. At source
 *    pitch the gaps land at 0.25px and the three units merge into one block.
 *
 * The 0.8 group scale sets the shield's circumradius to 169 against the ring's
 * 224 inner edge, leaving 1.5px of clearance; the rack rides inside that group
 * so its fit against the shield walls holds at any scale.
 *
 * Status dots and text lines are absent by necessity — 4 units is 0.16px.
 */
export const EVOCLOUD_ICON_SMALL = 'custom:evocloud-20';

addIcon(EVOCLOUD_ICON_SMALL, {
  body: `<circle cx="256" cy="256" r="240" fill="none" stroke="currentColor" stroke-width="32"/>
  <g transform="translate(256 256) scale(.8) translate(-256 -256)">
    <path fill="none" stroke="currentColor" stroke-width="40" d="${SHIELD_BLUE_OUTER}"/>
    <path fill="currentColor" d="M154,127.5h208v32h-208zM168,181.5h178v35h-178zM168,238.5h178v35h-178zM168,295.5h178v35h-178zM154,352.5h208v32h-208z"/>
  </g>`,
  width: 512,
  height: 512,
});
