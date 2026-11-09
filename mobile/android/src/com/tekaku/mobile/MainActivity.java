package com.tekaku.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.AtomicFile;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;
import org.json.JSONArray;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
  private static final int MAX_DOCUMENT = 2 * 1024 * 1024;
  private static final int OPEN = 101, CREATE = 102, IMAGE = 103;
  private static final String ORIGIN = "https://appassets.androidplatform.net/";
  private final ExecutorService io = Executors.newSingleThreadExecutor();
  private WebView web;
  private static final int MAX_DRAFT = 16 * 1024 * 1024;
  private static final class DocumentRef {
    final String id, name; final Uri uri;
    DocumentRef(String id, String name, Uri uri){this.id=id;this.name=name;this.uri=uri;}
  }
  private static final class Incoming {
    final Uri uri; final String text;
    Incoming(Uri uri,String text){this.uri=uri;this.text=text;}
  }
  private final Map<String,DocumentRef> documents = new ConcurrentHashMap<>();
  private final ConcurrentLinkedQueue<Incoming> incoming = new ConcurrentLinkedQueue<>();
  private String pickerId, pickerContent, pickerName, pickerDocId;
  private boolean pageReady;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    web = new WebView(this);web.setBackgroundColor(Color.WHITE);web.setFitsSystemWindows(true);
    WebSettings settings = web.getSettings();settings.setJavaScriptEnabled(true);
    settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setDomStorageEnabled(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);
    settings.setSafeBrowsingEnabled(true);WebView.setWebContentsDebuggingEnabled(false);
    web.addJavascriptInterface(new Bridge(), "TekakuNative");
    web.setWebViewClient(new WebViewClient() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri=request.getUrl();
        if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())) {
          String path=uri.getPath();
          if (path==null || !"GET".equals(request.getMethod()) || path.contains("..") || path.contains("\\")) return denied();
          if (path.equals("/")) path="/index.html";
          if (!(path.equals("/index.html") || path.startsWith("/assets/"))) return denied();
          try {
            String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".html")?"text/html":"application/octet-stream";
            return new WebResourceResponse(mime,"UTF-8",getAssets().open("web"+path));
          } catch(Exception ignored) {return denied();}
        }
        // Only explicitly inserted HTTPS images can use the network. CSP blocks
        // scripts, frames and fetch outside the local packaged origin.
        if ("https".equals(uri.getScheme())) return null;
        return denied();
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
        if (request.getUrl().toString().equals(ORIGIN+"index.html")) return false;
        if(request.hasGesture()) openLink(request.getUrl().toString());
        return true;
      }
      @Override public void onPageFinished(WebView view,String url) {pageReady=true;}
    });
    setContentView(web);acceptIntent(getIntent());web.loadUrl(ORIGIN+"index.html");
  }

  private static WebResourceResponse denied() {
    return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new java.io.ByteArrayInputStream(new byte[0]));
  }
  @Override public void onNewIntent(Intent intent) {super.onNewIntent(intent);setIntent(intent);acceptIntent(intent);if(!incoming.isEmpty()&&pageReady)web.evaluateJavascript("window.__tekakuIncoming && window.__tekakuIncoming()",null);}
  private void acceptIntent(Intent intent) {
    if(intent==null)return;
    try {
      if(Intent.ACTION_VIEW.equals(intent.getAction()))queueIncoming(intent.getData(),intent);
      else if(Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
        ArrayList<Uri> uris=intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
        if(uris!=null)for(Uri uri:uris)queueIncoming(uri,intent);
      } else if(Intent.ACTION_SEND.equals(intent.getAction())) {
        Uri uri=intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if(uri!=null)queueIncoming(uri,intent);
        else {CharSequence value=intent.getCharSequenceExtra(Intent.EXTRA_TEXT);if(value!=null&&value.length()<=MAX_DOCUMENT)incoming.add(new Incoming(null,value.toString()));}
      }
    }catch(Exception ignored){}
  }
  private void queueIncoming(Uri uri,Intent source) {
    if(uri==null||!"content".equals(uri.getScheme())||incoming.size()>=64)return;
    try {getContentResolver().takePersistableUriPermission(uri,source.getFlags()&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION));}catch(Exception ignored){}
    incoming.add(new Incoming(uri,null));
  }
  @Override public void onBackPressed() {
    if(!pageReady){finish();return;}
    web.evaluateJavascript("typeof window.__tekakuBack === 'function' ? (window.__tekakuBack(), true) : false",value->{if("false".equals(value))finish();});
  }
  @Override protected void onPause(){if(pageReady)web.evaluateJavascript("window.mobileEditor && window.mobileEditor.flushDraft()",null);super.onPause();}
  @Override protected void onDestroy(){if(web!=null){web.removeJavascriptInterface("TekakuNative");web.destroy();}io.shutdown();super.onDestroy();}

  private final class Bridge {
    @JavascriptInterface public void request(String raw) {
      if(raw==null||raw.length()>MAX_DRAFT*2)return;
      try {
        JSONObject request=new JSONObject(raw);String id=request.getString("id"),action=request.getString("action");JSONObject data=request.optJSONObject("data");
        runOnUiThread(()->handle(id,action,data==null?new JSONObject():data));
      } catch(Exception ignored) {}
    }
  }
  private interface Work {Object run() throws Exception;}
  private void work(String id,Work action){io.execute(()->{try{reply(id,action.run(),null);}catch(Exception error){reply(id,null,error.getMessage()==null?"文件操作失败":error.getMessage());}});}
  private void reply(String id,Object result,String error){
    String json;
    try{String array=new JSONArray().put(result==null?JSONObject.NULL:result).toString();json=array.substring(1,array.length()-1);}catch(Exception ignored){json="null";}
    final String script="window.__tekakuReply("+JSONObject.quote(id)+","+json+","+(error==null?"null":JSONObject.quote(error))+")";
    runOnUiThread(()->{if(!isFinishing()&&!isDestroyed())web.evaluateJavascript(script,null);});
  }

  private void handle(String id,String action,JSONObject data) {
    try {
      switch(action) {
        case "ready": work(id,()->{
          JSONObject draft=null;boolean draftError=false;documents.clear();
          try {
            JSONObject saved=readPrivate("draft.json");
            if(saved!=null){
              JSONArray source=saved.optJSONArray("tabs");if(source==null)source=new JSONArray().put(saved);
              JSONArray restored=new JSONArray();
              for(int i=0;i<source.length()&&i<64;i++){
                JSONObject tab=source.optJSONObject(i);if(tab==null)continue;
                String content=tab.optString("content","");if(content.getBytes(StandardCharsets.UTF_8).length>MAX_DOCUMENT){draftError=true;continue;}
                Uri uri=null;String rawUri=tab.optString("uri","");
                if(!rawUri.isEmpty()){
                  Uri candidate=Uri.parse(rawUri);
                  if("content".equals(candidate.getScheme())&&checkUriPermission(candidate,android.os.Process.myPid(),android.os.Process.myUid(),Intent.FLAG_GRANT_READ_URI_PERMISSION)==PackageManager.PERMISSION_GRANTED)uri=candidate;
                }
                String token=tab.optString("docId","");try{token=UUID.fromString(token).toString();}catch(Exception invalid){token=UUID.randomUUID().toString();}
                if(documents.containsKey(token))token=UUID.randomUUID().toString();
                DocumentRef ref=new DocumentRef(token,tab.optString("name","未命名.md"),uri);documents.put(token,ref);
                restored.put(document(ref,content).put("dirty",tab.optBoolean("dirty",true)).put("uri",uri==null?"":uri.toString()));
              }
              if(restored.length()>0){
                int selected=Math.max(0,Math.min(saved.optInt("activeIndex",0),restored.length()-1));
                draft=new JSONObject(restored.getJSONObject(selected).toString()).put("tabs",restored).put("activeIndex",selected).put("theme",saved.optString("theme","white"));
              }
            }
          }catch(Exception invalid){draftError=true;documents.clear();}
          if(draft==null){DocumentRef ref=register(null,"未命名.md");return new JSONObject().put("draft",JSONObject.NULL).put("incoming",!incoming.isEmpty()).put("docId",ref.id).put("draftError",draftError);}
          return new JSONObject().put("draft",draft).put("incoming",!incoming.isEmpty()).put("docId",draft.getString("docId")).put("draftError",draftError);
        });break;
        case "draft": work(id,()->{
          JSONArray source=data.optJSONArray("tabs");if(source==null)source=new JSONArray().put(data);
          if(source.length()>64)throw new Exception("打开的文档过多，请保存并关闭部分标签");
          JSONArray saved=new JSONArray();
          for(int i=0;i<source.length();i++){
            JSONObject entry=source.getJSONObject(i);DocumentRef ref=requireDocument(entry);String content=entry.optString("content","");requireContent(content);
            saved.put(document(ref,content).put("dirty",entry.optBoolean("dirty")).put("uri",ref.uri==null?"":ref.uri.toString()));
          }
          if(saved.length()==0)throw new Exception("没有可保存的文档草稿");
          int selected=Math.max(0,Math.min(data.optInt("activeIndex",0),saved.length()-1));
          JSONObject result=new JSONObject(saved.getJSONObject(selected).toString()).put("tabs",saved).put("activeIndex",selected).put("theme",data.optString("theme","white"));
          writePrivate("draft.json",result,MAX_DRAFT);return true;
        });break;
        case "new": work(id,()->document(register(null,"未命名.md"),""));break;
        case "close": work(id,()->{String token=data.getString("docId");if(token.equals(pickerDocId))throw new Exception("请先完成当前文件选择");documents.remove(token);return true;});break;
        case "open": choose(id,OPEN,null,null);break;
        case "image": choose(id,IMAGE,null,null);break;
        case "save": case "saveAs":
          final DocumentRef ref=requireDocument(data);final String content=data.getString("content");requireContent(content);
          final boolean saveAs="saveAs".equals(action);
          io.execute(()->{
            try {
              DocumentRef target=requireDocument(data);
              if(!saveAs&&target.uri!=null&&canWrite(target.uri))reply(id,save(target,target.uri,content,true),null);
              else runOnUiThread(()->{
                try{if(pickerId!=null)throw new Exception("请先完成当前文件选择");pickerContent=content;choose(id,CREATE,safeName(data.optString("name",ref.name)),ref.id);}
                catch(Exception failure){reply(id,null,failure.getMessage());}
              });
            }catch(Exception failure){reply(id,null,failure.getMessage());}
          });break;
        case "incoming": work(id,()->{Incoming item=incoming.poll();if(item==null)return null;if(item.uri!=null)return open(item.uri);requireContent(item.text);return document(register(null,"分享笔记.md"),item.text);});break;
        case "discardIncoming": incoming.clear();reply(id,true,null);break;
        case "backup": work(id,()->{JSONObject saved=readPrivate("backup.json");if(saved==null)return null;return document(register(null,saved.optString("name","恢复副本.md")),saved.getString("content")).put("dirty",true);});break;
        case "copy": ((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("代码",data.getString("text")));reply(id,true,null);break;
        case "openLink": openLink(data.getString("url"));reply(id,true,null);break;
        case "theme": applyTheme(data.optString("value"));reply(id,true,null);break;
        case "exit": reply(id,true,null);finish();break;
        default: reply(id,null,"不支持的操作");
      }
    } catch(Exception error){reply(id,null,error.getMessage()==null?"文件操作失败":error.getMessage());}
  }

  private DocumentRef requireDocument(JSONObject data)throws Exception {
    DocumentRef ref=documents.get(data.optString("docId",""));if(ref==null)throw new Exception("文档标识已失效，请重新打开该文件");return ref;
  }
  private void requireContent(String content)throws Exception{if(content==null||content.getBytes(StandardCharsets.UTF_8).length>MAX_DOCUMENT)throw new Exception("单篇文档不能超过 2 MiB");}
  private DocumentRef register(Uri uri,String name)throws Exception {
    if(uri!=null)for(DocumentRef ref:documents.values())if(uri.equals(ref.uri))return ref;
    if(documents.size()>=64)throw new Exception("打开的文档过多，请保存并关闭部分标签");
    DocumentRef ref=new DocumentRef(UUID.randomUUID().toString(),name,uri);documents.put(ref.id,ref);return ref;
  }
  private void choose(String id,int operation,String name,String targetDocId) {
    if(pickerId!=null){reply(id,null,"请先完成当前文件选择");return;}
    pickerId=id;pickerName=name;pickerDocId=targetDocId;
    Intent intent=new Intent(operation==CREATE?Intent.ACTION_CREATE_DOCUMENT:Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(operation==IMAGE?"image/*":operation==CREATE?"text/markdown":"*/*");
    if(operation==OPEN){intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"text/markdown","text/x-markdown","text/plain","application/octet-stream"});intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);}
    if(operation==CREATE)intent.putExtra(Intent.EXTRA_TITLE,name);
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
    try{startActivityForResult(intent,operation);}catch(Exception error){pickerId=null;pickerDocId=null;pickerContent=null;reply(id,null,"此设备没有可用的文件选择器");}
  }
  @Override protected void onActivityResult(int operation,int resultCode,Intent result) {
    super.onActivityResult(operation,resultCode,result);if(pickerId==null)return;
    String id=pickerId,content=pickerContent,targetDocId=pickerDocId;pickerId=null;pickerContent=null;pickerDocId=null;
    if(resultCode!=RESULT_OK||result==null){reply(id,null,null);return;}
    ArrayList<Uri> uris=new ArrayList<>();
    if(result.getClipData()!=null)for(int i=0;i<result.getClipData().getItemCount();i++)uris.add(result.getClipData().getItemAt(i).getUri());
    else if(result.getData()!=null)uris.add(result.getData());
    if(uris.isEmpty()){reply(id,null,null);return;}
    for(Uri uri:uris)try{getContentResolver().takePersistableUriPermission(uri,result.getFlags()&(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION));}catch(Exception ignored){}
    work(id,()->{
      if(operation==IMAGE)return image(uris.get(0));
      if(operation==CREATE){DocumentRef ref=documents.get(targetDocId);if(ref==null)throw new Exception("文档已关闭，请重新保存");return save(ref,uris.get(0),content,false);}
      Set<String> previous=new HashSet<>(documents.keySet());
      try{JSONArray resultDocs=new JSONArray();for(Uri uri:uris)resultDocs.put(open(uri));return resultDocs;}
      catch(Exception failure){for(String token:new HashSet<>(documents.keySet()))if(!previous.contains(token))documents.remove(token);throw failure;}
    });
  }
  private JSONObject open(Uri uri)throws Exception {
    if(!"content".equals(uri.getScheme()))throw new Exception("请通过系统文件选择器打开 Markdown");
    String name=displayName(uri);if(!name.toLowerCase(Locale.ROOT).matches(".*\\.(md|markdown|txt)$"))throw new Exception("请选择 .md、.markdown 或 .txt 文件");
    String content=decode(read(uri,MAX_DOCUMENT));return document(register(uri,name),content);
  }
  private JSONObject document(DocumentRef ref,String content)throws Exception{return new JSONObject().put("name",ref.name).put("content",content).put("bound",ref.uri!=null).put("docId",ref.id);}
  private byte[] read(Uri uri,int limit)throws Exception {
    try(InputStream input=getContentResolver().openInputStream(uri)){if(input==null)throw new Exception("无法读取文件");return limited(input,limit);}
  }
  private static byte[] limited(InputStream input,int limit)throws Exception {
    ByteArrayOutputStream output=new ByteArrayOutputStream();byte[] buffer=new byte[16384];int count;
    while((count=input.read(buffer))!=-1){if(output.size()+count>limit)throw new Exception("文件过大，Markdown 上限 2 MiB，图片上限 1 MiB");output.write(buffer,0,count);}return output.toByteArray();
  }
  private static String decode(byte[] bytes)throws Exception {
    String text=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
    if(text.startsWith("\ufeff"))text=text.substring(1);if(text.indexOf('\0')>=0)throw new Exception("文件不是有效的 UTF-8 Markdown 文本");return text;
  }
  private JSONObject image(Uri uri)throws Exception {
    byte[] bytes=read(uri,1024*1024);String mime=getContentResolver().getType(uri);
    if(!("image/png".equals(mime)||"image/jpeg".equals(mime)||"image/gif".equals(mime)||"image/webp".equals(mime)))throw new Exception("请选择 PNG、JPEG、GIF 或 WebP 图片");
    BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);
    if(bounds.outWidth<=0||bounds.outHeight<=0||(long)bounds.outWidth*bounds.outHeight>16000000)throw new Exception("图片格式无效或尺寸过大");
    return new JSONObject().put("src","data:"+mime+";base64,"+Base64.encodeToString(bytes,Base64.NO_WRAP)).put("alt",displayName(uri));
  }
  private JSONObject save(DocumentRef ref,Uri uri,String content,boolean replacing)throws Exception {
    byte[] bytes=content.getBytes(StandardCharsets.UTF_8);if(bytes.length>MAX_DOCUMENT)throw new Exception("单篇文档不能超过 2 MiB");
    for(DocumentRef other:documents.values())if(!other.id.equals(ref.id)&&uri.equals(other.uri))throw new Exception("此文件已在另一个标签打开，请另选保存位置");
    if(replacing){String previous=decode(read(uri,MAX_DOCUMENT));writePrivate("backup.json",new JSONObject().put("name",ref.name).put("content",previous),6*1024*1024);}
    try {
      ParcelFileDescriptor descriptor=getContentResolver().openFileDescriptor(uri,"rw");if(descriptor==null)throw new Exception("文件提供程序不允许写入");
      try(FileOutputStream output=new ParcelFileDescriptor.AutoCloseOutputStream(descriptor)){
        FileChannel channel=output.getChannel();channel.position(0);
        ByteBuffer buffer=ByteBuffer.wrap(bytes);while(buffer.hasRemaining())channel.write(buffer);
        channel.truncate(bytes.length);channel.force(true);
      }
    } catch(Exception error){throw new Exception(replacing?"保存失败，已保留写入前副本。可在更多菜单恢复；也可另存为到本机文件夹。":"保存失败，请尝试另存为到本机文件夹。");}
    DocumentRef updated=new DocumentRef(ref.id,displayName(uri),uri);documents.put(ref.id,updated);return document(updated,content);
  }
  private boolean canWrite(Uri uri) {
    if(checkUriPermission(uri,android.os.Process.myPid(),android.os.Process.myUid(),Intent.FLAG_GRANT_WRITE_URI_PERMISSION)!=PackageManager.PERMISSION_GRANTED)return false;
    try(Cursor cursor=getContentResolver().query(uri,new String[]{DocumentsContract.Document.COLUMN_FLAGS},null,null,null)){
      return cursor!=null&&cursor.moveToFirst()&&(cursor.getInt(0)&DocumentsContract.Document.FLAG_SUPPORTS_WRITE)!=0;
    } catch(Exception ignored){return false;}
  }
  private String displayName(Uri uri) {
    try(Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
      if(cursor!=null&&cursor.moveToFirst()){String name=cursor.getString(0);if(name!=null&&!name.isEmpty())return name;}
    } catch(Exception ignored){}return "文档.md";
  }
  private static String safeName(String name)throws Exception{if(name.isEmpty()||name.length()>120||java.util.regex.Pattern.compile("[\\x00-\\x1f/\\\\]").matcher(name).find())throw new Exception("请输入有效的文件名");return name.toLowerCase(Locale.ROOT).matches(".*\\.(md|markdown|txt)$")?name:name+".md";}
  private JSONObject readPrivate(String name)throws Exception {
    AtomicFile file=new AtomicFile(new File(getFilesDir(),name));
    try(FileInputStream input=file.openRead()){return new JSONObject(decode(limited(input,"draft.json".equals(name)?MAX_DRAFT:6*1024*1024)));}catch(java.io.FileNotFoundException missing){return null;}
  }
  private void writePrivate(String name,JSONObject data,int limit)throws Exception {
    byte[] bytes=data.toString().getBytes(StandardCharsets.UTF_8);if(bytes.length>limit)throw new Exception("本机草稿过大，请保存到文件");
    AtomicFile file=new AtomicFile(new File(getFilesDir(),name));FileOutputStream output=null;
    try{output=file.startWrite();output.write(bytes);file.finishWrite(output);}catch(Exception error){if(output!=null)file.failWrite(output);throw error;}
  }
  private void openLink(String raw) {
    Uri uri=Uri.parse(raw);String scheme=uri.getScheme();
    if(!("https".equals(scheme)||"http".equals(scheme)||"mailto".equals(scheme)))return;
    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}
  }
  private void applyTheme(String theme) {
    boolean dark="night".equals(theme);int color=Color.parseColor(dark?"#1c1f25":"paper".equals(theme)?"#faf7ef":"sage".equals(theme)?"#f1f5ed":"#ffffff");
    getWindow().setStatusBarColor(color);getWindow().setNavigationBarColor(color);web.setBackgroundColor(color);
    getWindow().getDecorView().setSystemUiVisibility(dark?0:View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
  }
}
