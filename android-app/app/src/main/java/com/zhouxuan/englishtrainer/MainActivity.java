package com.zhouxuan.englishtrainer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * 一个「只有一个 WebView」的壳，把站点的整套文件装进安装包里。
 *
 * 它做三件事，缺一件这个 App 就是残的：
 *
 *   1. 用 WebViewAssetLoader 把安装包里的文件当成一个正经的 https 站点喂给页面。
 *      ⚠️ 不能图省事直接 loadUrl("file:///android_asset/index.html")：
 *         那样页面是 file:// 源，站里用 fetch 取的题库 / 词典 / OCR 引擎
 *         会被同源策略全部拦掉，localStorage 在 file:// 下也不可靠 ——
 *         而答题记录、错题、生词、划线全都存在 localStorage 里。
 *         换成一个假域名（appassets.androidplatform.net）之后，
 *         fetch 和 localStorage 的行为和线上站一模一样。
 *
 *   2. 实现 onShowFileChooser。不实现，「我的 → 选文件导入」在 App 里
 *      点了是**毫无反应**的：页面以为弹了选择器，其实请求被整个丢掉了。
 *
 *   3. 挂一个 JS 桥给页面的「导出」。WebView 不处理 <a download> 的 blob 下载，
 *      页面上那条路在手机上是哑的（不弹保存、不报错、什么都不发生）。
 *      页面会把要保存的文字交给这里，由原生写进「下载」文件夹。
 */
public class MainActivity extends Activity {

    /** 假的本地域名，配合 WebViewAssetLoader 使用 */
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    /** 导出的文件放在「下载/<这个名字>/」下面 */
    private static final String DIR_NAME = "英语备考训练台";
    private static final int REQ_FILE = 1001;

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);

        web = new WebView(this);
        setContentView(web, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings st = web.getSettings();
        st.setJavaScriptEnabled(true);
        /* 本地存储不开，答题记录 / 生词 / 划线 / 打卡一样都存不下来。
           这是整个 App 的命根子，别动。 */
        st.setDomStorageEnabled(true);
        st.setDatabaseEnabled(true);
        st.setTextZoom(100);                 // 不理系统的字体放大，免得排版被撑坏
        st.setUseWideViewPort(true);
        st.setLoadWithOverviewMode(true);
        st.setBuiltInZoomControls(false);
        st.setDisplayZoomControls(false);
        st.setMediaPlaybackRequiresUserGesture(false);   // 听力音频不用再点一次
        st.setJavaScriptCanOpenWindowsAutomatically(false);
        st.setAllowFileAccess(false);        // 页面不经 file:// 读文件（本地资源走上面那个 https 假域名）
        /* ⚠️ 这一条**必须**保持 true，别顺手"加固"成 false：
           setAllowContentAccess(false) 会让「选文件导入」在 App 里彻底哑掉 ——
           系统选择器照样弹得出来，但选完的那份文件递不进页面，
           表现就是"点了文件、什么都没发生"。这是 WebView 的老行为。 */
        st.setAllowContentAccess(true);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = cb;
                try {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    /* ⚠️ 站点里那个「选文件夹」在安卓上是选不了的 ——
                       系统文件选择器根本没有"选一个目录"这回事。
                       这里统一按"选文件（可多选）"处理；页面在 App 里
                       也已经把文案改成了「点这里选文件」，两边对得上。 */
                    boolean multi = params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE;
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multi);
                    startActivityForResult(Intent.createChooser(i, "选择文件"), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "这台设备上没有文件选择器", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new ShellBridge(), "AndroidShell");

        if (saved == null) {
            web.loadUrl(ORIGIN + "/assets/index.html");
        } else {
            web.restoreState(saved);
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req != REQ_FILE) { super.onActivityResult(req, res, data); return; }
        Uri[] out = null;
        if (res == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                out = new Uri[n];
                for (int k = 0; k < n; k++) out[k] = data.getClipData().getItemAt(k).getUri();
            } else if (data.getData() != null) {
                out = new Uri[]{ data.getData() };
            }
        }
        if (filePathCallback != null) filePathCallback.onReceiveValue(out);
        filePathCallback = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    /** 返回键：先退页面自己的历史（站里是 #哈希 路由），退到头了再退出 App */
    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(code, e);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("AndroidShell");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /* ------------------------------------------------------------------
       给页面用的桥。页面上对应的代码在 app.js 的 download() 里：
         window.AndroidShell 存在 → 走这里；不存在（浏览器）→ 走网页那条路。
       ------------------------------------------------------------------ */
    private class ShellBridge {

        /**
         * 页面调用：AndroidShell.saveText(文件名, MIME, 文字内容)
         * 返回一句给使用者看的话（页面会拿它弹提示）。空字符串表示"别提示"。
         */
        @JavascriptInterface
        public String saveText(String name, String mime, String text) {
            try {
                String safe = safeName(name);
                String mt = (mime == null || mime.isEmpty())
                        ? "application/octet-stream" : mime;
                byte[] bytes = (text == null ? "" : text).getBytes(StandardCharsets.UTF_8);

                if (Build.VERSION.SDK_INT >= 29) {
                    /* Android 10 起用 MediaStore：文件落在大家都能看到的
                       「内部存储/Download/英语备考训练台/」里，
                       而且**不需要申请任何存储权限**。
                       （走 getExternalFilesDir 的话会被塞进 Android/data/，
                        新版系统的文件管理器和微信都看不见，导出就没意义了。） */
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                    cv.put(MediaStore.MediaColumns.MIME_TYPE, mt);
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH,
                            Environment.DIRECTORY_DOWNLOADS + "/" + DIR_NAME);
                    Uri uri = getContentResolver()
                            .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) return "保存失败：系统没给建文件";
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) return "保存失败：写不进去";
                    os.write(bytes);
                    os.flush();
                    os.close();
                } else {
                    /* Android 8 / 9：那会儿还没有 MediaStore.Downloads。
                       退到应用自己的外部目录 —— 不需要权限，
                       而且这两个版本的文件管理器看得见。 */
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) return "保存失败：没有可写的目录";
                    if (!dir.exists() && !dir.mkdirs()) return "保存失败：建不了目录";
                    FileOutputStream fo = new FileOutputStream(new File(dir, safe));
                    fo.write(bytes);
                    fo.flush();
                    fo.close();
                }
                return "已保存到「下载/" + DIR_NAME + "/" + safe + "」";
            } catch (Exception e) {
                /* 桥里抛异常会让页面那边直接报错停在半路，所以一律吞掉改成一句话 */
                return "保存失败：" + e.getClass().getSimpleName();
            }
        }
    }

    /** 文件名里的斜杠、冒号会被当成路径，去掉 */
    private static String safeName(String name) {
        String s = (name == null ? "" : name).trim();
        s = s.replace('/', '_').replace('\\', '_').replace(':', '_')
             .replace('*', '_').replace('?', '_').replace('"', '_')
             .replace('<', '_').replace('>', '_').replace('|', '_');
        if (s.isEmpty()) s = "导出.txt";
        if (s.length() > 100) s = s.substring(0, 100);
        return s;
    }
}
