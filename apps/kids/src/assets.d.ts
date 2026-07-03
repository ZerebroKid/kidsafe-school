/**
 * Lets TypeScript resolve static image/Lottie asset imports that Metro bundles
 * at build time. The runtime value for images is an opaque asset-registry id
 * (a number) accepted by `<Image source={...} />`; Lottie JSON resolves to a
 * plain object. Metro -- not tsc -- performs the actual asset resolution.
 */
declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module '*.mp4' {
  const value: number;
  export default value;
}
