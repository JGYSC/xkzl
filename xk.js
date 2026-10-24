var HOST='',headers={'User-Agent':'okhttp/3.15'},classes=[],cates={},picUrl='',webPaths={},descTpl='';
function isHttp(u){return/^https?:\/\//i.test(u)}

function cleanDesc(s){
  if(!s)return'';
  s=String(s);
  var dc=(s.match(/\$/g)||[]).length;
  if(dc>3&&/第\d+集|我要报错|复制链接/.test(s))return'';
  s=s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  s=s.replace(/^[^\s：:]{1,30}(?:剧情|简介|介绍|详情)[:：]\s*/,'');
  s=s.replace(/^[^\s]{0,30}的在线播放\s*/,'');
  s=s.replace(/\s+/g,' ').trim();
  if(s.length<15)return'';
  if(s.length>2000)s=s.substring(0,2000);
  return s;
}

function init(str){
  if(!str)return;
  // 针对 JSON 资源格式的解析
  if(str.indexOf('&&&')<0 && str.indexOf('#')<0 && /\.json($|\?)/i.test(str)){
    try{
      var resp=req(str,{method:'GET',headers:headers});
      var json=JSON.parse(resp.content||resp.body||resp);
      
      // 1. 多源列表格式
      if(json && json.length && json[0] && json[0].url && !json[0].url && !json.vodSeries && !json.liveChannels){
        for(var i=0;i<json.length;i++){
          var it=json[i];
          if(!it||!it.url)continue;
          var srcName=(it.name||('源'+(i+1))).trim();
          var realUrl=it.url,picTpl='';
          if(it.url.indexOf('&&&')>0){
            realUrl=it.url.split('&&&')[0].trim();
            picTpl=it.url.split('&&&')[1].trim();
          }
          var tid=srcName+'$'+realUrl;
          classes.push({type_id:tid,type_name:srcName.replace('!!','')});
          if(picTpl)webPaths[tid]=picTpl;
        }
        console.log('多源列表加载完成，共 '+classes.length+' 个源');
        return;
      }

      // 2. 星空影仓格式（点播分类）
      if(json && json.vodSeries){
        var cats={},order=[];
        for(var i=0;i<json.vodSeries.length;i++){
          var c=(json.vodSeries[i].category||'未分类').trim();
          if(!cats[c]){cats[c]=1;order.push(c);}
        }
        for(var j=0;j<order.length;j++){
          var cateName=order[j];
          classes.push({
            type_id:'星空影仓$'+str+'$'+cateName,
            type_name:cateName
          });
        }
        console.log('星空影仓加载完成，共 '+order.length+' 个分类');
      }

      // 3. 星空直播格式（liveChannels直播分类） ★ 新增
      if(json && json.liveChannels){
        var liveCats={},liveOrder=[];
        for(var k=0;k<json.liveChannels.length;k++){
          var lc=(json.liveChannels[k].category||'未分类').trim();
          var lcName = lc.indexOf('直播') >= 0 ? lc : lc + '直播';
          if(!liveCats[lcName]){liveCats[lcName]=1;liveOrder.push(lcName);}
        }
        for(var m=0;m<liveOrder.length;m++){
          var lcName = liveOrder[m];
          var originalCate = lcName.replace('直播', ''); 
          classes.push({
            type_id:'星空直播$'+str+'$'+originalCate,
            type_name:lcName
          });
        }
        console.log('星空直播加载完成，共 '+liveOrder.length+' 个分类');
      }

      // 如果从JSON中成功解析出任何分类，直接返回，跳过后面的普通解析
      if(classes.length > 0) return;
      
    }catch(e){console.log('init JSON 解析失败: '+e)}
  }

  // --- 以下是原有保留的特殊格式解析逻辑 ---
  var host='';
  if(str.indexOf('&&&')>0){host=str.split('&&&')[0].trim();str=str.split('&&&')[1].trim();}
  if(str.indexOf('&&&')>0){
    picUrl=str.split('&&&')[1].trim();
    if(picUrl.indexOf('://')<0)picUrl=host+picUrl;
    str=str.split('&&&')[0].trim();
  }
  if(str.indexOf('@@@')>0){descTpl=str.split('@@@')[1].trim();str=str.split('@@@')[0].trim();}
  console.log('picUrl: '+picUrl);
  var lines=str.split('#');
  for(var i=0;i<lines.length;i++){
    var line=lines[i].trim();if(!line)continue;
    if(line.indexOf('$')>0){
      var typeName=line.split('$')[0],typeId=line;
      if(typeId.indexOf('://')<0)typeId=typeId.replace('$','$'+host);
      classes.push({type_id:typeId,type_name:typeName.replace('!!','')});
    }else{
      var url=line;
      if(url.indexOf('://')<0)url=host+url;
      url=url.replace('/file/livesourcelist','/livesourcelist');
      try{
        var resp2=req(url,{method:'GET',headers:headers});
        var json2=JSON.parse(resp2.content);
        var base=url.substring(0,url.lastIndexOf('/')+1);
        for(var j=0;j<json2.length;j++){
          var itm=json2[j],name=itm.name,u=itm.url;
          var tid2=name+'$'+(u.indexOf('://')<0?base:'')+u;
          classes.push({type_id:tid2,type_name:name.replace('!!','')});
          webPaths[tid2]=base;
        }
      }catch(e){console.log('==== >>> '+e)}
    }
  }
}

function home(){return JSON.stringify({class:classes,filters:null})}

function parseM3u(content,defaultGroup){
  var groups={},reg=/(#EXTINF:.+?),([^,]+?)\s*\n(.+?)\s*\n/g,m;
  while((m=reg.exec(content))!=null){
    var extinf=m[1],name=m[2],url=m[3];
    if(!name||!url)continue;
    name=name.trim();url=url.trim();
    var group=defaultGroup,gReg=/group-title="(.*?)"/;
    if(gReg.test(extinf))group=extinf.match(gReg)[1];
    if(!groups[group])groups[group]=[];
    groups[group].push(name+','+url);
  }
  var out='';
  for(var g in groups){out+=g+',#genre#\n';for(var k=0;k<groups[g].length;k++)out+=groups[g][k]+'\n';}
  return out;
}
function parseFm(content){
  var out='',json=JSON.parse(content);
  for(var i=0;i<json.length;i++){
    var ch=json[i];out+=(ch.name||'')+',#genre#\n';
    var urls=ch.urls||[];
    for(var j=0;j<urls.length;j++){
      var u=urls[j],lines=u.line||[];
      for(var k=0;k<lines.length;k++)out+=(u.name||'')+','+lines[k]+'\n';
    }
  }
  return out;
}
function parseLu(content){
  var out='',json=JSON.parse(content),list=(json.data&&json.data.datalist)||[];
  for(var i=0;i<list.length;i++){
    var item=list[i];out+=(item.prov||'')+',#genre#\n';
    var arr=item.list||[];
    for(var j=0;j<arr.length;j++){
      var ch=arr[j],lines=ch.line||[];
      for(var k=0;k<lines.length;k++)out+=(ch.name||'')+'---'+(lines[k].name||'')+','+(lines[k].url||'')+'\n';
    }
  }
  return out;
}

function parseXk(content,cateFilter){
  var json=JSON.parse(content),series=json.vodSeries||[],out='';
  for(var i=0;i<series.length;i++){
    var s=series[i],cate=(s.category||'未分类').trim();
    if(cateFilter && cate!==cateFilter) continue;
    var name=s.title||('未命名_'+s.id),eps=s.episodes||[],playUrl='';
    for(var j=0;j<eps.length;j++){
      var ep=eps[j],epName=ep.title||('第'+ep.num+'集'),epUrl=ep.url||'';
      if(!epUrl)continue;
      if(playUrl)playUrl+='#';
      playUrl+=epName+'$'+epUrl;
    }
    if(!playUrl)continue;
    out+=cate+',#genre#\n'+name+'\x01'+(s.cover||'')+'\x01'+(s.detailPage||'')+'\x01'+eps.length+'\x01'+cleanDesc(s.content)+'\x01'+playUrl+'\n';
  }
  return out;
}

function buildDesc(name,cate,id,cover,detail,ep){
  if(descTpl)return descTpl.replace(/\{name\}/g,name).replace(/\{cate\}/g,cate).replace(/\{id\}/g,id).replace(/\{cover\}/g,cover||'').replace(/\{detail\}/g,detail||'').replace(/\{ep\}/g,ep||'');
  return detail?('详情页：'+detail):'';
}

/* ================= 核心 ================= */
function getCateData(typeId){
  var pic=picUrl;
  if(typeId.indexOf('&&&')>0){
    pic=typeId.split('&&&')[1].trim();
    if(pic.indexOf('://')<0&&webPaths[typeId])pic=webPaths[typeId]+pic;
    typeId=typeId.split('&&&')[0].trim();
  }
  console.log('webPicUrl: '+pic);

  // ★★★ 星空直播专属处理 ★★★
  if(typeId.indexOf('星空直播$') === 0){
    var xkParts = typeId.split('$');
    var jsonPath = xkParts[1];
    var liveCate = xkParts.slice(2).join('$');
    
    if(!cates[typeId]){
      cates[typeId] = [];
      var content = req(jsonPath, {method:'GET', headers: headers});
      content = (content.content || content.body || content).trim();
      var json = JSON.parse(content);
      var liveList = json.liveChannels || [];
      
      var channels = [];
      for (var i = 0; i < liveList.length; i++) {
        var ch = liveList[i];
        var chCate = (ch.category || '未分类').trim();
        if (chCate !== liveCate) continue;
        if (!ch.name || !ch.url) continue;
        channels.push(ch.name + '$' + ch.url);
      }
      
      if (channels.length > 0) {
        var idx = cates[typeId].length;
        cates[typeId].push({
          vod_id: typeId + '$$$' + idx,
          vod_name: liveCate + ' 频道列表',
          vod_pic: '', 
          vod_remarks: channels.length + '个频道',
          type_name: '星空直播',
          vod_year: '', vod_area: '', vod_actor: '', vod_director: '',
          vod_content: '点击观看直播',
          vod_play_from: '星空直播',
          vod_play_url: channels.join('#'),
          _isGroup: true,
          _groupName: '星空直播'
        });
      }
    }
    return cates[typeId];
  }

  // ---- 星空影仓：点播逻辑原样保留 ----
  var xkCate='';
  if(typeId.indexOf('星空影仓$')===0){
    var xkParts=typeId.split('$');
    xkCate=xkParts.slice(2).join('$');
  }

  var realUrl=typeId.split('$')[1],sourceName=typeId.split('$')[0];
  if(!cates[typeId]){
    cates[typeId]=[];
    var h=headers;
    if(realUrl.indexOf('|')>0){
      var extra=decodeURIComponent(realUrl.split('|')[1]);
      realUrl=realUrl.split('|')[0];
      var kvs=extra.split('&');
      for(var i=0;i<kvs.length;i++){if(kvs[i].indexOf('=')>0)h[kvs[i].split('=')[0]]=kvs[i].split('=')[1]}
    }
    var content=req(realUrl,{method:'GET',headers:h});
    content=(content.content||content.body||content).trim();

    // ---- 格式自动识别 ----
    if(content.indexOf('#EXTM3U')>=0){
      content=parseM3u(content,sourceName);
    }else if(content.indexOf('"channel"')>0&&content.indexOf('"urls"')>0){
      content=parseFm(content);
    }else if(content.indexOf('"datalist"')>0&&content.indexOf('"urls"')>0){
      content=parseLu(content);
    }else if(content.indexOf('"vodSeries"')>=0){
      content=parseXk(content,xkCate);
    }

    // ================ 关键：按 #genre# 合并成多组 ================
    var groups=[];
    var curGroup=null;

    var arr=content.split('\n');
    for(var i=0;i<arr.length;i++){
      var raw=arr[i];if(!raw)continue;

      if(raw.indexOf('\x01')>0){
        var sp=raw.split('\x01');
        var nm=sp[0].trim(),cov=sp[1]||'',det=sp[2]||'',ep=sp[3]||'',desc=sp[4]||'',purl=sp[5]||'';
        if(nm&&purl){
          var idx=cates[typeId].length;
          var img=cov?cov:(pic?pic.replace('{name}',encodeURIComponent(nm)).replace('{cate}',encodeURIComponent(sourceName)):'');
          cates[typeId].push({
            vod_id:typeId+'$$$'+idx,
            vod_name:nm,
            vod_pic:img,
            vod_remarks:ep?('星空影仓('+ep+'集)'):'星空影仓',
            type_name:xkCate||sourceName,
            vod_year:'',vod_area:'',vod_actor:'',vod_director:'',
            vod_content:desc?desc:buildDesc(nm,xkCate||sourceName,idx,cov,det,ep),
            vod_play_from:sourceName,
            vod_play_url:purl
          });
        }
        continue;
      }

      if(raw.indexOf(',#genre#')>0){
        if(curGroup && curGroup.items.length>0) groups.push(curGroup);
        var gname=raw.split(',#genre#')[0].trim() || sourceName;
        curGroup={name:gname, items:[]};
        continue;
      }

      var line=raw.replace(/\s+$/,'');
      if(line=='')continue;
      var chName='',chUrl='';
      if(/^https?:\/\//i.test(line)){
        chName='频道';
        chUrl=line;
      }else if(line.indexOf(',')>0 && /https?:\/\//i.test(line)){
        var p1=line.split(',');
        chName=p1[0].trim();
        chUrl=p1.slice(1).join(',').trim();
      }else if(line.indexOf('|')>0 && /https?:\/\//i.test(line)){
        var p2=line.split('|');
        chName=p2[0].trim();
        chUrl=p2[1].trim();
      }else if(line.indexOf(' ')>=0 && /https?:\/\//i.test(line)){
        var p3=line.split(' ');
        chName=p3[0].trim();
        chUrl=p3.slice(1).join('').trim();
      }
      if(chName && chUrl){
        if(!curGroup)curGroup={name:sourceName, items:[]};
        curGroup.items.push(chName+'$'+chUrl);
      }
    }
    if(curGroup && curGroup.items.length>0) groups.push(curGroup);

    for(var gi=0;gi<groups.length;gi++){
      var grp=groups[gi];
      if(!grp.items.length)continue;
      var idx3=cates[typeId].length;
      var img3=pic?pic.replace('{name}',encodeURIComponent(grp.name)).replace('{cate}',encodeURIComponent(sourceName)):'';
      cates[typeId].push({
        vod_id:typeId+'$$$'+idx3,
        vod_name:grp.name,
        vod_pic:img3,
        vod_remarks:'',
        type_name:sourceName,
        vod_year:'',vod_area:'',vod_actor:'',vod_director:'',
        vod_content:buildDesc(grp.name,sourceName,idx3,'','',''),
        vod_play_from:sourceName,
        vod_play_url:grp.items.join('#'),
        _isGroup: true,
        _groupName: grp.name
      });
    }
  }
  return cates[typeId];
}

function homeVod(){return JSON.stringify({list:getCateData(classes[0].type_id)})}
function category(tid,pg,filter,extend){return JSON.stringify({list:pg==1?getCateData(tid):[]})}

function detail(id){
  var parts=id.split('$$$'),typeId=parts[0],idx=parseInt(parts[1]);
  var list=getCateData(typeId),item=null;
  for(var i=0;i<list.length;i++){if(String(list[i].vod_id)===String(id)){item=list[i];break}}
  if(!item)item=list[idx]||list[0];
  if(!item)return JSON.stringify({list:[]});
  console.log('detail: '+JSON.stringify(item));

  if(item._isGroup){
    var urls=item.vod_play_url.split('#');
    var froms=[item._groupName||'默认'];
    var groups=[urls.join('#')];
    item.vod_play_from=froms.join('$$$');
    item.vod_play_url=groups.join('$$$');
  }
  return JSON.stringify({list:[item]});
}

function play(flag,id,flags){return JSON.stringify({parse:0,url:id})}
function search(key,quick){
  if(!key)return JSON.stringify({list:[]});
  key=key.toLowerCase();
  var result=[],seen={};
  for(var i=0;i<classes.length;i++){
    var tid=classes[i].type_id,list;
    try{list=getCateData(tid)}catch(e){continue}
    if(!list)continue;
    for(var j=0;j<list.length;j++){
      var v=list[j];
      if(v.vod_name&&v.vod_name.toLowerCase().indexOf(key)>=0&&!seen[v.vod_id]){seen[v.vod_id]=1;result.push(v)}
    }
  }
  return JSON.stringify({list:result});
}
__JS_SPIDER__={init:init,home:home,homeVod:homeVod,category:category,detail:detail,play:play,search:search};