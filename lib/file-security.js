const MAX_PRIVATE_UPLOAD_BYTES=8*1024*1024;

const MIME_RULES=Object.freeze({
  'application/pdf':{extensions:['pdf'],kind:'pdf'},
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':{extensions:['docx'],kind:'docx'},
  'text/plain':{extensions:['txt'],kind:'text'},
  'image/png':{extensions:['png'],kind:'png'},
  'image/jpeg':{extensions:['jpg','jpeg'],kind:'jpeg'}
});

function toBuffer(bytes){
  if(Buffer.isBuffer(bytes))return bytes;
  if(bytes instanceof Uint8Array)return Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes instanceof ArrayBuffer)return Buffer.from(bytes);
  throw new Error('invalid_upload_bytes');
}

function extensionOf(value){
  const name=String(value||'').split('/').pop()||'';
  const match=name.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  return match?.[1]||'';
}

export function normalizeUploadFilename(value){
  const raw=String(value||'file').normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g,'')
    .replace(/[\\/]+/g,'-')
    .replace(/\.\.+/g,'.')
    .replace(/[^A-Za-z0-9._ -]+/g,'-')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/^\.+/,'')
    .slice(0,120);
  return raw||'file';
}

export function assertSafeStoragePath(value){
  const path=String(value||'');
  if(!path||path.length>512)throw new Error('unsafe_storage_path');
  if(path.startsWith('/')||path.includes('\\')||path.includes('\u0000')||path.includes('//'))throw new Error('unsafe_storage_path');
  if(/[\u0000-\u001f\u007f]/.test(path))throw new Error('unsafe_storage_path');
  const decoded=(()=>{try{return decodeURIComponent(path)}catch{return path}})();
  if(decoded.split('/').some((part)=>part==='..'||part==='.')||/[\\]/.test(decoded))throw new Error('unsafe_storage_path');
  return path;
}

function hasPrefix(buffer,values){
  if(buffer.length<values.length)return false;
  return values.every((value,index)=>buffer[index]===value);
}

function magicMatches(buffer,kind){
  if(kind==='pdf')return buffer.subarray(0,5).toString('ascii')==='%PDF-';
  if(kind==='png')return hasPrefix(buffer,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if(kind==='jpeg')return hasPrefix(buffer,[0xff,0xd8,0xff]);
  if(kind==='docx'){
    if(!hasPrefix(buffer,[0x50,0x4b,0x03,0x04])&&!hasPrefix(buffer,[0x50,0x4b,0x05,0x06]))return false;
    const sample=buffer.subarray(0,Math.min(buffer.length,2*1024*1024)).toString('latin1');
    return sample.includes('[Content_Types].xml')&&sample.includes('word/');
  }
  if(kind==='text'){
    if(buffer.includes(0x00))return false;
    try{new TextDecoder('utf-8',{fatal:true}).decode(buffer);return true}catch{return false}
  }
  return false;
}

export function validatePrivateUpload({
  bytes,mimeType,filename='',storagePath='',sizeBytes=null,maxBytes=MAX_PRIVATE_UPLOAD_BYTES
}){
  const buffer=toBuffer(bytes);
  const mime=String(mimeType||'').toLowerCase();
  const rule=MIME_RULES[mime];
  if(!rule)throw new Error('unsupported_file_type');
  const size=Number(sizeBytes??buffer.length);
  if(!Number.isSafeInteger(size)||size<=0||size>maxBytes||size!==buffer.length)throw new Error('invalid_file_size');

  const target=filename||storagePath;
  const ext=extensionOf(target);
  if(filename&&!ext)throw new Error('file_extension_mismatch');
  if(ext&&!rule.extensions.includes(ext))throw new Error('file_extension_mismatch');
  if(!magicMatches(buffer,rule.kind))throw new Error('file_content_mismatch');

  if(storagePath)assertSafeStoragePath(storagePath);
  return {buffer,mimeType:mime,sizeBytes:size,extension:ext};
}

export { MAX_PRIVATE_UPLOAD_BYTES, MIME_RULES };
