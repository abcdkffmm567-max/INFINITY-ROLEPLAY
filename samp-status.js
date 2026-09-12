const dgram=require("dgram");
const HOST="148.113.8.119", PORT=26000;
function query(){
  return new Promise((resolve,reject)=>{
    const ip=HOST.split(".").map(Number), b=Buffer.alloc(11);
    b.write("SAMP",0,"ascii"); ip.forEach((n,i)=>b[4+i]=n);
    b[8]=PORT&255; b[9]=(PORT>>8)&255; b[10]="i".charCodeAt(0);
    const s=dgram.createSocket("udp4");
    let done=false;
    const finish=(e,d)=>{if(done)return;done=true;clearTimeout(t);try{s.close()}catch{};e?reject(e):resolve(d)};
    const t=setTimeout(()=>finish(new Error("timeout")),2500);
    s.on("error",finish);
    s.on("message",m=>{
      try{
        let o=11;
        o++; const players=m.readUInt16LE(o);o+=2; const maxPlayers=m.readUInt16LE(o);o+=2;
        const read=()=>{const l=m.readUInt32LE(o);o+=4;const v=m.toString("utf8",o,o+l);o+=l;return v};
        resolve({online:true,players,maxPlayers,hostname:read(),gamemode:read(),language:read()});
        done=true;clearTimeout(t);s.close();
      }catch(e){finish(e)}
    });
    s.send(b,PORT,HOST,e=>{if(e)finish(e)});
  })
}
exports.handler=async()=>{
  try{
    const d=await query();
    return {statusCode:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify(d)};
  }catch(e){
    return {statusCode:200,headers:{"Content-Type":"application/json","Cache-Control":"no-store"},body:JSON.stringify({online:false,players:0,maxPlayers:0,error:e.message})};
  }
};