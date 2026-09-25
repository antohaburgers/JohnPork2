if('serviceWorker' in navigator){
 addEventListener('load',async()=>{try{
  const hadController=!!navigator.serviceWorker.controller;
  const reg=await navigator.serviceWorker.register('./sw.js');
  const button=document.getElementById('update-button');
  const offer=()=>{if(!reg.waiting)return;button.hidden=false;button.onclick=()=>{reg.waiting.postMessage({type:'ACTIVATE'});};};
  offer();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});
  let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing||!hadController)return;refreshing=true;location.reload();});
 }catch{/* Local files and unavailable networks can still run the game. */}});
}
