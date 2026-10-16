# 安卓安装包（android-app）

把站点的整套文件装进一个 APK，给不方便记网址、或者担心手机清缓存的人用。

**这里不手工编译。** 本机没有 JDK / Android SDK，而安卓 SDK 的官方下载源
在国内基本拉不动；实际打包跑在 GitHub Actions 上，见仓库根目录的
`.github/workflows/android.yml`。

- 每次改到站点文件（`index.html` / `app.js` / `style.css` / `data/` / `ocr/`）并推到 `main`，
  会自动出一版新的 APK
- 产物挂在 **Release `apk-latest`** 上，直链固定不变：

  ```
  https://github.com/zhouxuan078-max/english-exam-trainer/releases/latest/download/EnglishTrainer.apk
  ```

  文件名用纯英文，是为了这条直链不用转码、发给别人不别扭。

## 三条不能忘的约束

### 1. `keystore.p12` 绝对不能重新生成

安卓认「同一个 App」靠**签名**而不是名字。同一把钥匙签出来的新版装到旧版上
是「升级」，答题记录、错题、打卡、生词都留着；换了钥匙系统就当成另一个 App，
直接拒绝安装 —— 同学只能先卸载（数据一起没）。

> ⚠️ 安卓工具链自动生成的 debug 钥匙**每次都不一样**，而 GitHub 的构建机
> 每次都是干净的 —— 所以不能图省事用 debug 签名，必须把钥匙固定下来放进仓库。
> `app/build.gradle` 里 release 和 debug **都用**这把钥匙，就是这个原因。

> 这把钥匙是公开的（仓库是公开的），也就是说理论上有人能签一个冒充新版装进来。
> 自用 / 同学之间传着用无所谓；哪天真要上应用商店，请换成存在
> GitHub Secrets 里的私有钥匙。

### 2. 站点文件是**构建时**拷进 `assets/` 的

`app/src/main/assets/` 在 `.gitignore` 里，不提交。CI 每次从仓库根目录
`cp -r index.html app.js style.css data ocr` 过去。

这样做的好处：站点改了，APK 自然跟着改，仓库里不用再存一份 12MB 的副本，
也不会出现「两边不一致」。代价是**不能在本机直接编译**（没有 assets）。

### 3. 壳里那三件事缺一不可

见 `MainActivity.java` 里的注释，简单说：

| 做的事 | 不做会怎样 |
|---|---|
| `WebViewAssetLoader` 把本地文件当成 https 站点喂给页面 | 用 `file://` 的话 `fetch` 会被同源策略全部拦掉（题库、词典、OCR 全是 fetch 取的），`localStorage` 也存不住 —— 而所有学习记录都在 `localStorage` 里 |
| 实现 `onShowFileChooser` | 「我的 → 选文件导入」点了**毫无反应**，导入功能整个废掉 |
| JS 桥 `AndroidShell.saveText` | 「导出 CSV / 导出 Anki / 导出备份」点了**毫无反应** —— WebView 不处理 `<a download>` 的 blob 下载 |

页面那边对应的分支在 `app.js`：`IN_SHELL` 常量和 `download()` 里的桥判断。
浏览器里 `window.AndroidShell` 是 `undefined`，那些分支一个都不会走 ——
线上站和 App 共用同一份代码。

## 已知的能力差异

- **「选文件夹」在 App 里没有**：安卓的系统文件选择器没有「选一个目录」这回事，
  只能一次选好几个文件。页面在 App 里已经把文案改成了「点这里选文件」。
  （DOM 里那个 `webkitdirectory` 输入框是留着的，只是永远点不到 ——
  这样网页那条路的结构一个字都没动。）
- **导出文件落在**「内部存储 / Download / 英语备考训练台 /」。
  Android 10 起走 MediaStore，不需要任何存储权限。
