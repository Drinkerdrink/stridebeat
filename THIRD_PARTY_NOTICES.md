# 第三方组件说明

## SoundTouchJS 0.3.0

- 上游：<https://github.com/cutterbl/SoundTouchJS>
- 网站使用文件：`dist/vendor/soundtouch.js`，保留原始实现及版权声明。
- 许可证：`dist/vendor/SoundTouch-LICENSE.txt`（LGPL 2.1）。
- 可读实现和包含原始源码内容的 source map：`third-party-source/soundtouchjs/`。

## lamejs 1.2.1

- 上游：<https://github.com/zhuker/lamejs>
- 网站使用文件：`dist/vendor/lame.js`。在上游 `lame.min.js` 末尾添加了 `export { lamejs };`，便于作为 ES 模块加载，没有修改编码算法。
- 上游许可说明：`dist/vendor/Lamejs-LICENSE.txt`；LGPL 2.1 全文：`dist/vendor/LGPL-2.1.txt`。
- 随包提供上游 JavaScript / Java 源码、可读合并文件 `lame.all.js` 与构建相关文件，位于 `third-party-source/lamejs/`。

以上许可证适用于各自的第三方组件，不代表为整个应用额外指定同一种许可。应用代码以可读 JavaScript、HTML、CSS 形式提供。分享包不包含第三方示例歌曲或原用户的音乐文件。
