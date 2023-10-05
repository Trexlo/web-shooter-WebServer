import * as THREE from 'three';
import { io } from 'socket.io-client';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as  BufferGeometryUtils  from 'three/addons/utils/BufferGeometryUtils.js';
import 'jquery';
const urlParams = new URLSearchParams(window.location.search);
const gId = urlParams.get("id");
const player = JSON.parse(localStorage.getItem("player"));
console.log(player);

var thisPlayer = null;
var players = new Map();
var enemies = new Map();
var pickups = new Map();
const loader = new GLTFLoader();
var actions = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    reload: false,
    fire: false,
}
var playersElement = document.getElementById("players");
var ammoElement = document.getElementById("ammo-text");
var reloadingElement = document.getElementById("reloading-text");
var playersElementTemplate = document.getElementById("player-template");

var statusText = document.getElementById("status-text");

var menuElement = document.getElementById("menu");
var resumeButton = document.getElementById("resume-button");
var pauseButton = document.getElementById("pause-button");
var saveButton= document.getElementById("save-button");
var exitButton = document.getElementById("exit-button");
var continueButton = document.getElementById("continue-button");
continueButton.onclick = (ev) => {
    socket.disconnect();
    window.location.assign('/');
}
var gameInfoElement = document.getElementById("game-info");
var timerElement = document.getElementById("time-info");

var pointsElement = document.getElementById("points");
var magazineUpgradeElement = document.getElementById("magazineUpgrade");
var healthUpgradeElement = document.getElementById("healthUpgrade");
var speedUpgradeElement = document.getElementById("speedUpgrade");
var firerateUpgradeElement = document.getElementById("firerateUpgrade");
var damageUpgradeElement = document.getElementById("damageUpgrade");

var ammoPackTexture;
var healthPackTexture;
var zombieModel;
var zombieAnimations;
var playerModel;
var playerAnimations;
var gunSound;


class Pickup {
    constructor(id, initialDuration) {
        this.id = id;
        this.initialDuration = initialDuration;
    }
    initialDuration;
    id;
    model;
}
class Player {
    constructor(id, nickname, color, image, ammo, mag, health, points, reloading, upgradeCost, attributes, position, rotation, dead) {
        console.log("constructing "+id);
        console.log({id, nickname, color, image, ammo, mag, health, points, reloading, upgradeCost, attributes, position, rotation, dead});
        this.id = id;
        this.nickname = nickname;
        this.color = color;
        this.image = image;
        this.ammo = ammo;
        this.mag = mag;
        this.health = health;
        this.points = points;
        this.reloading = reloading;
        this.upgradeCost = upgradeCost;
        this.attributes = attributes;
        this.position.old = new THREE.Vector3(position.x,position.y,position.z);
        this.rotation.old = new THREE.Euler(rotation.x,rotation.y,rotation.z);
        this.position.new = new THREE.Vector3(position.x,position.y,position.z);
        this.rotation.new = new THREE.Euler(rotation.x,rotation.y,rotation.z);;
        this.dead = dead;
        this.model = new THREE.Group();//new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshToonMaterial({color:0x00ff00}));//;
        this.model.castShadow=true;
        this.model.position.set(position.x,position.y,position.z);
        this.model.rotation.set(rotation.x,rotation.y,rotation.z);
       
        
        var audio = new THREE.PositionalAudio( listener );
        audio.setBuffer(gunSound);
        audio.setRefDistance( 20 );
        audio.setVolume(0.3);
        audio.setPlaybackRate(0.4/this.attributes.firerate);
        var gs = audio;
        gs.name="gunSound";
        this.model.add(gs);

      
        var tmpModel = SkeletonUtils.clone(playerModel);
        var sizeVec =  new THREE.Vector3();
        tmpModel.children[0].children[0].geometry.boundingBox.getSize(sizeVec);
        var scaleDiff = 2/sizeVec.y;
        tmpModel.scale.set(scaleDiff,scaleDiff,scaleDiff);
        tmpModel.children[0].children[0].geometry.computeBoundingBox();
        var mat = tmpModel.children[0].children[0].material.clone();
        mat.color = new THREE.Color(color);
        tmpModel.children[0].children[0].material = mat;
        this.model.add(tmpModel);
       



        var labelCanvas = document.createElement('canvas');
        labelCanvas.width=200*5;
        labelCanvas.height=25*5;
        var labelCtx = labelCanvas.getContext("2d");

        labelCtx.font = "80px Verdana";
        console.log(labelCtx.measureText(nickname).width);
        if(labelCtx.measureText(nickname).width>500){
             console.log( Math.trunc(80*(500/labelCtx.measureText(nickname).width))+"px Verdana");
             labelCtx.font = Math.trunc(80*(500/labelCtx.measureText(nickname).width))+"px Verdana";
        }
        labelCtx.fillStyle = color+"88";
        labelCtx.textAlign = "center";
        labelCtx.fillText(nickname, 500, 100, 1000);
        
        labelCtx.fillStyle = "rgba(0, 0, 0, 1)";
        labelCtx.strokeText(nickname, 500, 100, 1000);
        var label = new THREE.Sprite();
        const imgLoader = new THREE.ImageLoader();

       
        var texture = new THREE.Texture(labelCanvas);
        texture.needsUpdate = true; //just to make sure it's all up to date.
        
        var lMaterial = new THREE.SpriteMaterial({ map: texture });
        label.material = lMaterial

        label.center.set(0, 0);
        label.scale.set(0.04/0.9,0.008/0.9,0.008/0.9)
        label.position.set(0,2,0)
        this.model.add(label);
        scene.add(this.model);
        const box2 = new THREE.Box3();
        
        box2.setFromCenterAndSize( new THREE.Vector3(0,0,0), new THREE.Vector3(0.75,1.75,0.75));

        const helper = new THREE.Box3Helper( box2, 0x00ffff );
        helper.userData.debugObject = true;
        helper.visible = false;
        this.model.add( helper );
        
        const curve = new THREE.EllipseCurve(
            0,  0,            // ax, aY
            20, 20,           // xRadius, yRadius
            0,  2 * Math.PI,  // aStartAngle, aEndAngle
            false,            // aClockwise
            90                 // aRotation
        );
        
        const curvepoints = curve.getPoints( 50 );
        const curvegeometry = new THREE.BufferGeometry().setFromPoints( curvepoints );
        
        const curvematerial = new THREE.LineBasicMaterial( { color: 0xff0000 } );
        // Create the final object to add to the scene
        const ellipse = new THREE.Line( curvegeometry, curvematerial );
        ellipse.rotateX(THREE.MathUtils.degToRad(90))
        ellipse.userData.debugObject = true;
        ellipse.visible = false;
        this.model.add(ellipse);
        if(player.id==id) ammoElement.textContent = this.mag+"/"+this.ammo;
        var tmp = playersElementTemplate.cloneNode(true);

        $(tmp).find(".player-image").attr('src', "/images/userImages/"+image);
        labelCtx.font=$(tmp).find(".player-name").css('font-style');
        if(labelCtx.measureText(nickname).width>$(tmp).find(".player-name").width()){

        }
        $(tmp).find(".player-name").text(this.nickname);
        $(tmp).attr("id", id);
        playersElement.appendChild(tmp)

        this.mixer = new THREE.AnimationMixer(this.model);
        
        var idleClip = THREE.AnimationClip.findByName( playerAnimations, 'Idle' );
        var walkingClip = THREE.AnimationClip.findByName( playerAnimations, 'Walking' );

        this.animations.set('Idle', idleClip);
        this.animations.set('Walking', walkingClip);
    }
    id;
    nickname;
    color;
    image;
    model;
    mixer;
    animations = new Map();
    animationClock;
    ammo;
    mag;
    health;
    points;
    reloading;
    upgradeCost;
    attributes;
    shots = [];
    position = {
        old:{}, new:{}
    };
    rotation = {
        old:{}, new:{}
    };
    dead;
    updateState(data){
        this.ammo = data.ammo;
        this.mag = data.mag;
        this.health = data.health;
        this.points = data.points;
        this.reloading = data.reloading;
        this.upgradeCost = data.upgradeCost;
        if(this.attributes.firerate != data.attributes.firerate) this.model.children.find(c=>c.name=="gunSound").setPlaybackRate(0.4/data.attributes.firerate);
        this.attributes = data.attributes;
        this.position.old = this.position.new;
        this.rotation.old = this.rotation.new;
        this.position.new = new THREE.Vector3(data.position.x,data.position.y,data.position.z);
        this.rotation.new = new THREE.Euler(data.rotation.x,data.rotation.y,data.rotation.z);

        if(Math.abs(this.rotation.new.x-this.rotation.old.x)>2)
            this.rotation.old.x = this.rotation.new.x;
        if(Math.abs(this.rotation.new.y-this.rotation.old.y)>2)
            this.rotation.old.y = this.rotation.new.y;
        if(Math.abs(this.rotation.new.z-this.rotation.old.z)>2)
            this.rotation.old.z = this.rotation.new.z;

        this.shots = this.shots.concat(data.shots);

        if(!this.position.old.equals(this.position.new)){
            var idleAction = this.mixer.existingAction(this.animations.get('Idle'));
            var walkingAction = this.mixer.clipAction(this.animations.get('Walking'));
            walkingAction.timeScale = this.attributes.speed/3.75;
            walkingAction.play();
            if(idleAction!=null)
                idleAction.stop();
        }else{
            var walkingAction = this.mixer.existingAction(this.animations.get('Walking'));
            var idleAction = this.mixer.clipAction(this.animations.get('Idle'));
            idleAction.play();
            if(walkingAction!=null)
                walkingAction.stop();
        }
        
        if(this.dead != data.dead && this.id == player.id){
            gameInfoElement.textContent = "You died, click to spectate";
            crosshair.material.color.setRGB(0,0,0);
        }

        if(this.id == spectatingId){
            if(this.dead != data.dead){
                gameInfoElement.textContent += " (died)";
            }
            $(reloadingElement).attr("hidden", !this.reloading);
            if(this.reloading){
                $(reloadingElement).css("animation-duration",  this.attributes.reloadingTime+"s");
            }
            $(pointsElement).text(this.points);
            $(speedUpgradeElement).find('.value').text(this.attributes.speed);
            $(healthUpgradeElement).find('.value').text(this.attributes.maxHealth);
            $(damageUpgradeElement).find('.value').text(this.attributes.damage);
            $(magazineUpgradeElement).find('.value').text(this.attributes.magSize);
            $(firerateUpgradeElement).find('.value').text(1/this.attributes.firerate);

            $(speedUpgradeElement).find('.cost').text(this.upgradeCost.player);
            $(healthUpgradeElement).find('.cost').text(this.upgradeCost.player);
            $(damageUpgradeElement).find('.cost').text(this.upgradeCost.weapon);
            $(magazineUpgradeElement).find('.cost').text(this.upgradeCost.weapon);
            $(firerateUpgradeElement).find('.cost').text(this.upgradeCost.weapon);
            if(this.points>=this.upgradeCost.player && !this.dead){
                $(speedUpgradeElement).removeClass('unavailable');
                $(healthUpgradeElement).removeClass('unavailable');
            }else{
                $(speedUpgradeElement).addClass('unavailable');
                $(healthUpgradeElement).addClass('unavailable');
            }
            if(this.points>=this.upgradeCost.weapon && !this.dead){
                $(damageUpgradeElement).removeClass('unavailable');
                $(magazineUpgradeElement).removeClass('unavailable');
                $(firerateUpgradeElement).removeClass('unavailable');
            }else{
                $(damageUpgradeElement).addClass('unavailable');
                $(magazineUpgradeElement).addClass('unavailable');
                $(firerateUpgradeElement).addClass('unavailable');
            }
        }
        this.dead = data.dead;
    }
}
class Enemy {
    constructor(id, health, attributes, attacking, position, rotation, dead) {
        this.id = id;
        this.health = health;
        this.attributes = attributes;
        this.position.old = new THREE.Vector3(position.x,position.y,position.z);
        this.rotation.old = new THREE.Euler(rotation.x,rotation.y,rotation.z);
        this.position.new = new THREE.Vector3(position.x,position.y,position.z);
        this.rotation.new = new THREE.Euler(rotation.x,rotation.y,rotation.z);;
        this.dead = dead;
        this.model = new THREE.Group();//new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshToonMaterial({color:0x00ff00}));//;
        //this.model.castShadow=true;
        var tmpModel = SkeletonUtils.clone(zombieModel);
        var sizeVec =  new THREE.Vector3();
        tmpModel.children[0].children[0].geometry.boundingBox.getSize(sizeVec);
        var scaleDiff = this.attributes.size.y/sizeVec.y;
        tmpModel.scale.set(scaleDiff,scaleDiff,scaleDiff);
        tmpModel.children[0].children[0].geometry.computeBoundingBox();
        var mat = tmpModel.children[0].children[0].material.clone();
        mat.color = new THREE.Color(0.5,1.1-this.attributes.size.y/2,0.5);
        tmpModel.children[0].children[0].material = mat;
        this.model.add(tmpModel);
        
        this.model.position.set(position.x,position.y,position.z);
        this.model.rotation.set(rotation.x,rotation.y,rotation.z);
        scene.add(this.model);
        
        this.attacking = null;
        const box2 = new THREE.Box3();
    
        box2.setFromCenterAndSize( new THREE.Vector3( 0, 0 ,0 ), attributes.size );

        const helper = new THREE.Box3Helper( box2, 0x00ffff );
        this.model.add( helper );
        helper.userData.debugObject=true;
        helper.visible=devMode;

        const curve = new THREE.EllipseCurve(
            0,  0.75,            // ax, aY
            0.5, 0.5,           // xRadius, yRadius
            0,  2 * Math.PI,  // aStartAngle, aEndAngle
            false,            // aClockwise
            90                 // aRotation
        );
        
        const curvepoints = curve.getPoints( 50 );
        const curvegeometry = new THREE.BufferGeometry().setFromPoints( curvepoints );
        
        const curvematerial = new THREE.LineBasicMaterial( { color: 0xff0000 } );
        const attackArea = new THREE.Line(curvegeometry, curvematerial);
        attackArea.rotateX(THREE.MathUtils.degToRad(90))
        attackArea.userData.debugObject = true;
        attackArea.visible = devMode;
        this.model.add(attackArea);
        devScene.add( this.path );
        this.animationClock = new THREE.Clock();
        this.mixer = new THREE.AnimationMixer(this.model);
        var attackingClip = THREE.AnimationClip.findByName( zombieAnimations, 'Attack' );

        var walkingClip = THREE.AnimationClip.findByName( zombieAnimations, 'Walking' );

        this.animations.set('Attack', attackingClip);
        this.animations.set('Walking', walkingClip);
    }
    id;
    model;
    health;
    points;
    attributes;
    attacking;
    position = {
        old:{}, new:{}
    };
    rotation = {
        old:{}, new:{}
    };
    mixer;
    animations = new Map();
    animationClock;
    dead;
    path = new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({
        color: 0x0000ff
    }));
    forceKill(){
        if(!this.dead){
            this.dead = true;
            this.animationClock.start();
        }
    }
    updateState(data){
        if(data.path != null){
            var points = [];
            for(var p of data.path.points){
                points.push(new THREE.Vector3(p[0], 0, p[1]));
            }
            this.path.geometry.setFromPoints(points)
        }
        this.health = data.health;
        this.attributes = data.attributes;
        this.position.old = this.position.new;
        this.rotation.old = this.rotation.new;
        this.position.new = new THREE.Vector3(data.position.x,data.position.y,data.position.z);
        this.rotation.new = new THREE.Euler(data.rotation.x,data.rotation.y,data.rotation.z);
        if(Math.abs(this.rotation.new.y-this.rotation.old.y)>2)
            this.rotation.old = this.rotation.new;
        if(this.attacking != data.attacking && data.attacking){
            var attackingAction = this.mixer.clipAction(this.animations.get('Attack'));
            var walkingAction = this.mixer.existingAction(this.animations.get('Walking'));
            attackingAction.timeScale = (this.animations.get('Attack').duration)/this.attributes.attackRate;
            attackingAction.play();
            if(walkingAction!=null)
                walkingAction.stop();
        }
        if(this.attacking != data.attacking && !data.attacking){
            var walkingAction = this.mixer.clipAction(this.animations.get('Walking'));
            var attackingAction = this.mixer.existingAction(this.animations.get('Attack'));
            walkingAction.timeScale = this.attributes.speed/2;
            walkingAction.play();
            if(attackingAction!=null)
                attackingAction.stop();
        }
        this.attacking = data.attacking;
        this.dead = data.dead;
        if(data.dead){
            this.animationClock.start();
        }
    }
}
var socket = null
var configuration = {
    direction: null,
    cameraOffset: null,
    sendingFrequency: 60,
}
var w = window.innerWidth;
var h = window.innerHeight;

const scene = new THREE.Scene();
const devScene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer( { antialias : false } );
const sceneHud = new THREE.Scene();


const camera = new THREE.PerspectiveCamera(75, w / h, 1, 2100);
const devCamera = new THREE.PerspectiveCamera(90, w / h, 1, 2100);
const cameraHud = new THREE.OrthographicCamera(- w / 2, w / 2, h / 2, - h / 2, 0.1, 1000);
devCamera.position.set(0,50,0);
devCamera.lookAt(0,0,0);    
cameraHud.left = - w / 2;
cameraHud.right = w / 2;
cameraHud.top = h / 2;
cameraHud.bottom = - h / 2;
cameraHud.updateProjectionMatrix();
cameraHud.position.z = 10;
camera.position.set(1, 5, 1)

renderer.setSize(w, h);
renderer.setPixelRatio( window.devicePixelRatio );
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
renderer.outputEncoding = THREE.LinearEncoding;
document.getElementById("game").appendChild(renderer.domElement);

const listener = new THREE.AudioListener();
camera.add( listener );

//large invisible plane for mouse to world projection
let aimplane = null;

//defines pointer
let crosshair = null;

//mouse position in canvas
const mouse = new THREE.Vector2();
//global pointer position on screen
const pointer = new THREE.Vector2();
//point in 3d world where the mouse points at from the camera perspective
const aimingAt = new THREE.Vector3();

var movedMouse = true;
//pointer locked?
var inFocus = false;


var connecting = false;
var loading = false;
var setupDone = false;
var asyncLoaded = false;
var focused = false;
var started = false;
var paused = false;
var gameEnd = false;
var playerIds = [];

var flatObjects;


function initSocket() {
    connecting = true;
    $(statusText).find('span').text("Connecting...")
    var ip = localStorage.getItem("serverIp");
    var port = localStorage.getItem("serverPort");
    var url = localStorage.getItem("serverUrl");
    console.log("init with ip and port: " + ip+":"+port);
    console.log("init with url: " + url);
    socket = io("wss://" + url, {
        //withCredentials: true,
        query: {
            gameId: gId,
            playerId: player.id
        },
        // extraHeaders: {
        //   "my-custom-header": "abcd"
        // },
    });
    socket.emit("joinLobby", { id: gId, player: player }, (msg) => {
        if (msg.error) {
            console.log("Could not join: " + msg.message);
            $(statusText).css("display", "block");
            $(continueButton).css("display", "block"); 
            $(continueButton).text("Back to menu");
            $(menuElement).hide();
            $(statusText).html(msg.message);
        } else {
            load();
        }
    });
    socket.on('stateUpdate', (data) => {
        if(!started)return;
        var sentTime = new Date(data.sentAt);
        var currTime = new Date();
        $('#packet-ping-counter').text("PACKET "+data.packetNumber+" PING: "+currTime.toJSON()+" - "+sentTime.toJSON()+" = "+(currTime-sentTime)+"ms");
        $(timerElement).text(('0'+(Math.trunc((data.time)/60))).slice(-2)+":"+('0'+(Math.trunc(data.time)%60)).slice(-2));
        for(const p of data.players){
            players.get(p.id).updateState(p);
        }
        var enemyIds =  new Map(Array.from(enemies.keys()).map(x=> [x,x]));
        for(const e of data.enemies){
            if(enemies.has(e.id)){
                enemies.get(e.id).updateState(e);
                enemyIds.delete(e.id);
            }else{
                enemies.set(e.id, new Enemy(e.id, e.health, e.attributes, e.attacking, e.position, e.rotation, e.dead));
            }
        }
        for(const [id, eid] of enemyIds){
            enemies.get(id).forceKill();
        }

        var pickupIds =  new Map(Array.from(pickups.keys()).map(x=> [x,x]));
        for(const p of data.pickups){
            if(pickups.has(p.id)){
                var pickup = pickups.get(p.id);
                pickupIds.delete(p.id);
                if(p.pickedUp || p.duration<=0){
                    scene.remove(pickup.model);
                    pickups.delete(p.id);
                }
                pickup.model.material.opacity = p.duration/pickup.initialDuration;
            }else if(!pickups.has(p.id) && !p.pickedUp){
                var tmp = new Pickup(p.id, p.duration);
                var boxSize = new THREE.Vector3().copy(p.box.max).sub(p.box.min);
                switch(p.type){
                    case 'health': {
                        tmp.model = new THREE.Mesh(new THREE.BoxGeometry(boxSize.x, 0.25, boxSize.z), new THREE.MeshBasicMaterial({map: healthPackTexture, transparent:true}));
                    };break;
                    case 'ammo': {
                        tmp.model = new THREE.Mesh(new THREE.BoxGeometry(boxSize.x, 0.25, boxSize.z), new THREE.MeshBasicMaterial({map: ammoPackTexture, transparent:true}));
                    };break;
                }
                tmp.model.position.set(p.position.x, -1+(0.25/2), p.position.z);
                pickups.set(p.id, tmp);
                scene.add(tmp.model);
            }

        }
        for(const [id, eid] of pickupIds){
            scene.remove(pickups.get(id).model);
            pickups.delete(id);
        }
        frameTime=0;
    });
    socket.on('pause', (data)=>{
        paused = data.paused;
        if(paused){
            $(pauseButton).text("Unpause game");
            $(statusText).text(data.message);
            $(statusText).css("display", "block");
            if(inFocus){
                $("#overlay").css("background", "rgba(0, 0, 0, 0.7)");
                $("#info").css("display", "block");
            }
        }else{
            $(pauseButton).text("Pause game");
            $(statusText).text("");
            $(statusText).css("display", "none");
            if(inFocus){
                $("#overlay").css("background", "rgba(0, 0, 0, 0)");
                $("#info").css("display", "none");
            }
        }
    })
    socket.on('goalReached', (data)=>{
        $(statusText).css("display", "block");
        $(continueButton).css("display", "block"); 
        gameEnd=true;
        document.exitPointerLock();
        $(menuElement).hide();
        var time = Math.trunc((data.time)/60)+":"+(Math.trunc(data.time)%60)
        if(data.goalReached){
            $(statusText).html("Victory</br>Time: "+time);
        }else{
            $(statusText).html("Defeat</br>Time: "+time);
        }
    })
    socket.on('start', (data)=>{
        started=true;
        console.log("started all ready");
        $(statusText).css("display", "none");
        $("#overlay").css("background", "rgba(0, 0, 0, 0)");
        $("#info").css("display", "none");
        $(menuElement).hide();
        paused = data.paused;
        if(data.paused){
            $(pauseButton).text("Unpause game");
            $(statusText).text("Game paused");
            $(statusText).css("display", "block");
            if(inFocus){
                $("#overlay").css("background", "rgba(0, 0, 0, 0.7)");
                $("#info").css("display", "block");
            }
        }

        animate();
    })
};

var fromClickToShoot = {
    clicked:false,
    start:null,
    end:null,
}

async function load() {

    console.log("loading");
    loading = true;

    $(statusText).find('span').text("Loading...")

    var model = await loader.loadAsync( '/enemy.glb');
    var sizeVec =  new THREE.Vector3();
    model.scene.children[0].children[0].geometry.boundingBox.getSize(sizeVec);
    var diff = 2/sizeVec.y;
    model.scene.rotateOnAxis(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(-90));
    console.log(diff);
    model.scene.scale.set(diff,diff,diff);
    model.scene.children[0].children[0].geometry.computeBoundingBox();
    model.scene.children[0].children[0].castShadow=true;
    console.log(model);
    zombieAnimations = model.animations;
    zombieModel = SkeletonUtils.clone(model.scene);
    console.log(zombieModel);
    
    var pmodel = await loader.loadAsync( '/player.glb');
    var psizeVec =  new THREE.Vector3();
    pmodel.scene.children[0].children[0].geometry.boundingBox.getSize(psizeVec);
    var pdiff = 2/psizeVec.y;
    pmodel.scene.rotateOnAxis(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(-90));
    console.log(pdiff);
    pmodel.scene.scale.set(pdiff,pdiff,pdiff);
    pmodel.scene.children[0].children[0].geometry.computeBoundingBox();
    pmodel.scene.children[0].children[0].castShadow=true;
    console.log(pmodel);
    playerAnimations = pmodel.animations;
    playerModel = SkeletonUtils.clone(pmodel.scene);
    console.log(playerModel);

    const audioLoader = new THREE.AudioLoader();
    gunSound = await audioLoader.loadAsync( 'sounds/gunSound.mp3');
    
    socket.emit("requestData", { id: gId }, async (val) => {
        console.log("reqData");
        console.log(val);
        configuration = val.configuration;
        for (const p of val.players) {
            playerIds.push(p.id);
            if (!players.has(p.id) && player.id == p.id) {
                players.set(p.id,
                    new Player(p.id, p.nickname, p.color, p.image, p.ammo, p.mag, p.health, p.points, p.reloading, p.upgradeCost, p.attributes, p.position, p.rotation, p.dead)
                );
                camera.position.addVectors(new THREE.Vector3(p.position.x, p.position.y, p.position.z), configuration.cameraOffset);
                camera.lookAt(p.position.x, p.position.y, p.position.z);
            }
        }
        for (const p of val.players) {
            if (!players.has(p.id)) {
                players.set(p.id,
                    new Player(p.id, p.nickname, p.color, p.image, p.ammo, p.mag, p.health, p.points, p.reloading, p.upgradeCost, p.attributes, p.position, p.rotation, p.dead)
                );
            }
        }
        thisPlayer = players.get(player.id);
        spectatingId = player.id;

        console.log(thisPlayer);
        console.log(val.map.navmesh.find(x=> x.box == undefined));
        val.map.navmesh.forEach(n=>{
            var b = new THREE.Box3(new THREE.Vector3(n.x1,-0.9, n.z1), new THREE.Vector3(n.x2,-0.9, n.z2))
            var helper = new THREE.Box3Helper(b, (n.obstacle)?0xff0000:0x00ff00);
            devScene.add(helper);
        })
        var loadedMap = await (new THREE.ObjectLoader()).parseAsync(val.map.map);
        console.log(loadedMap);
        var forMerge=[];
        var forRemove=[];
        loadedMap.traverse(c=>{
            if(c.type=="Group"){
                forMerge.push({position: c.position, children:c.children, object:c});
                forRemove.push(c);
            }
        })
        console.log(forRemove);
        console.log(forMerge);
        for(var f of forRemove)loadedMap.remove(f);
        for(var f of forMerge){
            var split = [];
            var below = f.children.filter(x=>(x.position.y+f.position.y)<1);
            var above = f.children.filter(x=>(x.position.y+f.position.y)>=1);
            var belowMap = new Map();
            console.log(below);
            for(var x of below){
                if(x.material.map){   
                    if(belowMap.has(x.material.map)) belowMap.get(x.material.map).push(x)
                    else belowMap.set(x.material.map, [x]);
                }else{   
                    if(belowMap.has(""+x.material.color.r+x.material.color.g+x.material.color.b)) belowMap.get(""+x.material.color.r+x.material.color.g+x.material.color.b).push(x)
                    else belowMap.set(""+x.material.color.r+x.material.color.g+x.material.color.b, [x]);
                }
            }
            console.log(belowMap);
            var aboveMap = new Map();
            for(var x of above){
                if(x.material.map){   
                    if(aboveMap.has(x.material.map)) aboveMap.get(x.material.map).push(x)
                    else aboveMap.set(x.material.map, [x]);
                }else{   
                    
                    if(aboveMap.has(""+x.material.color.r+x.material.color.g+x.material.color.b)) aboveMap.get(""+x.material.color.r+x.material.color.g+x.material.color.b).push(x)
                    else aboveMap.set(""+x.material.color.r+x.material.color.g+x.material.color.b, [x]);
                }
            }
            console.log(above);
            console.log(aboveMap);

            
             // if(below.length>0)split.push(below);
             // if(above.length>0)split.push(above);
            split.push(Array.from(belowMap.values()));
            split.push(Array.from(aboveMap.values()));
            split = split.flat();
            console.log(split);
            for(var s of split){
                console.log(s);
                var merged = s[0].clone();
                if(s.length>1){
                    var size1 = new THREE.Vector3();
                    var size2 = new THREE.Vector3();
                    s[0].geometry.computeBoundingBox()
                    s[1].geometry.computeBoundingBox()
    
                    s[0].geometry.boundingBox.getSize(size1);
                    s[1].geometry.boundingBox.getSize(size2);
                    size1.multiply(s[0].scale)
                    size2.multiply(s[1].scale)
                    var box1 = new THREE.Box3();
                    box1.setFromCenterAndSize(s[0].position, size1);
                    var box2 = new THREE.Box3();
                    box2.setFromCenterAndSize(s[1].position, size2);
                    box1.expandByScalar(0.05)
                    box2.expandByScalar(0.05)
                    console.log(box1);
                    console.log(box2);
                    if(!box1.intersectsBox(box2)){
                        console.log("!intersects");
                        loadedMap.add(f.object);
                        continue;
                    }
                }   
                merged.geometry = BufferGeometryUtils.mergeGeometries(s.map(v=> {
                    var n=v.geometry.clone();
                    var t = new THREE.Vector3().copy(v.position);
                    n.translate(t.x,t.y,t.z);
                    return n;
                }));
                merged.geometry = BufferGeometryUtils.mergeVertices(merged.geometry);
                merged.geometry.computeBoundingBox();
                merged.position.copy(f.position);
                console.log(merged);
                loadedMap.add(merged);
            }

        }
        
        loadedMap.traverse(o => {
            if(o.isMesh){
                //console.log("mesh");
                o.receiveShadow=true;
                o.castShadow=true;
                //console.log(o);
                o.geometry.computeBoundingBox();
                o.geometry.boundingBox.translate(o.position);
                
                //console.log(o.geometry.boundingBox.getCenter(new THREE.Vector3()));
            }
        })
        // loadedMap.castShadow=true;
        // loadedMap.receiveShadow=true;
        
        // loadedMap.children.find(x=>x.type=="DirectionalLight").removeFromParent();
        // loadedMap.children.find(x=>x.type=="AmbientLight").removeFromParent();


        scene.add(loadedMap);
        flatObjects = scene.children.find(c=>c.type=="Scene").children.flatMap(x=>{
            if(x.type=="Group") {
                var objs = [];
                for(var c of x.children) objs.push({object:c, position:new THREE.Vector3(c.position.x+x.position.x,c.position.y+x.position.y, c.position.z+x.position.z)})
                //console.log(objs);
                return objs
            }
            else if(x.isMesh)return {object:x, position:x.geometry.boundingBox.getCenter(new THREE.Vector3())};//new THREE.Vector3(x.position.x,x.position.y, x.position.z)};
            else return [];
        }).filter(c=> c.object.isMesh && c.position.y>=1);
        flatObjects.forEach(o=> o.position.setY(0));
        console.log(flatObjects);
        if(val.map.type == "survival") $(timerElement).css('display', "block");
        setup();
    });
}

function setup() {
    //threejs
    console.log("setup");

    ammoPackTexture = new THREE.TextureLoader().load("../images/icons/ammoPack.png");
    healthPackTexture = new THREE.TextureLoader().load("../images/icons/healthPack.png");
    ammoPackTexture.rotation= THREE.MathUtils.degToRad(90);
    healthPackTexture.rotation= THREE.MathUtils.degToRad(90);
    ammoPackTexture.wrapS = THREE.RepeatWrapping;
    healthPackTexture.wrapS = THREE.RepeatWrapping;
    ammoPackTexture.wrapT = THREE.RepeatWrapping;
    healthPackTexture.wrapT = THREE.RepeatWrapping;
    let chTexture = new THREE.TextureLoader().load("../images/crosshair.png");
    chTexture.needsUpdate = true; //just to make sure it's all up to date.
    let chMaterial = new THREE.SpriteMaterial({ map: chTexture });
    crosshair = new THREE.Sprite(chMaterial);
    crosshair.center.set(0.5, 0.5)
    crosshair.geometry.scale(w / 20, w / 20);
    //aimplane = new THREE.Plane(new THREE.Vector3(1, 1, 0.2), 3);
    aimplane = new THREE.Mesh(new THREE.BoxGeometry(1000, 0.01, 1000), new THREE.MeshBasicMaterial({ transparent: true, visible: false }));
    aimplane.position.set(0, 0, 0);

    scene.add(aimplane)
    sceneHud.add(crosshair);
    
    //listeners
    renderer.domElement.addEventListener("click", (ev) => {
        if (!inFocus){
            renderer.domElement.requestPointerLock({
                unadjustedMovement: true,
            });
        }
        inFocus = true;
        if(!focused){
            focused = true;
            tryStart();
        }
    });
    renderer.domElement.addEventListener("mousedown", (ev) => {
        if (inFocus){
            if(thisPlayer.dead){
                spectatingId = playerIds[(playerIds.indexOf(spectatingId) + 1)%playerIds.length];
                if(thisPlayer.id == spectatingId){
                    gameInfoElement.textContent = "You (dead)";
                }else
                    gameInfoElement.textContent = "Spectating "+players.get(spectatingId).nickname+((players.get(spectatingId).dead?" (dead)":""));
            }
            actions.fire=true;
            if(!fromClickToShoot.clicked){
                fromClickToShoot.clicked=true;
                fromClickToShoot.start=new Date();
            }
        }
    });
    renderer.domElement.addEventListener("mouseup", (ev) => {
        if (inFocus){
            actions.fire=false;
        }
        if(fromClickToShoot.clicked){
            fromClickToShoot.clicked=false;
            fromClickToShoot.start=null;
            fromClickToShoot.end=null;
        }
    });
    renderer.domElement.addEventListener("pointermove", (ev) => {
        if (inFocus) {
            mouse.x += (mouse.x + 0.9 * ev.movementX < w / 2 && mouse.x + 0.9 * ev.movementX > -w / 2) ? 0.9 * ev.movementX : 0;
            mouse.y -= (mouse.y - 0.9 * ev.movementY < h / 2 && mouse.y - 0.9 * ev.movementY > -h / 2) ? 0.9 * ev.movementY : 0;
        } else {
            mouse.x = ev.clientX - w / 2;
            mouse.y = -ev.clientY + h / 2;
        }
        pointer.x = (mouse.x / (w / 2));
        pointer.y = (mouse.y / (h / 2));
        movedMouse = true;
    });
    pauseButton.onclick = (ev) =>{
        //socket send pause
        if(paused){
            socket.emit("pause", { gameId: gId, userId:player.id, paused:false })
        }else{
            socket.emit("pause", { gameId: gId, userId:player.id, paused:true})
        }
    }
    resumeButton.onclick = (ev) =>{
        //socket send unpaused
        renderer.domElement.requestPointerLock({
            unadjustedMovement: true,
        });
    }
    document.addEventListener("pointerlockchange", (ev) => {
        console.log("plc");
        console.log(document.pointerLockElement == renderer.domElement);
        inFocus = document.pointerLockElement == renderer.domElement;
        
        if(inFocus){
            $(menuElement).hide();
            if(started && !paused){
                $("#overlay").css("background", "rgba(0, 0, 0, 0)");
                $("#info").css("display", "none");
            }
        }else{
            if(!gameEnd){
                $(menuElement).css("display","flex");
                $("#info").css("display", "block");
            }
            $("#overlay").css("background", "rgba(0, 0, 0, 0.7)");
        
        }
    });
    window.addEventListener("resize", (ev) => {
        w = window.innerWidth;
        h = window.innerHeight;
        //camera.aspect=w/h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        cameraHud.left = - w / 2;
        cameraHud.right = w / 2;
        cameraHud.top = h / 2;
        cameraHud.bottom = - h / 2;
        cameraHud.updateProjectionMatrix();
        renderer.setSize(w, h);
    });

    document.onclose = (ev) => {
        socket.disconnect();
    }
    exitButton.onclick = (ev) => {
        socket.disconnect();
        window.location.assign('/');
    } 

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    
    saveButton.onclick = (ev) => {
        fetch('/saveGame',{
            method:"POST",
            headers:{
                "Content-Type": "application/json",
            },
            body:JSON.stringify({
                gameId: gId
            })
        }).then(res=>{
            res.json().then(d=>{
                console.log(d);
            })
        })
    }


    //start after all loaded and connected

    //socket to server -> "ready" 
    setupDone=true;
    console.log(scene);
    scene.receiveShadow=true;
    tryStart();
    


    renderer.clear();
    renderer.render(scene, (useDevCamera)?devCamera:camera);
    renderer.clearDepth();
    renderer.render(sceneHud, cameraHud);
};

function tryStart(){
    if(setupDone && !focused){
        $(statusText).text("Click to start")
    }
    if(setupDone && focused){
        socket.emit("ready", { gameId: gId, userId:player.id }, (msg) => {
            console.log(msg);
            $(statusText).text("Waiting for other players")

            sendingFunction = setInterval(() => {
                sendStateChange();
            }, 1000 / configuration.sendingFrequency);
        });
    }
}

var sendingFunction;

var counter = 0;
function sendStateChange() {
    //console.log(move);
    if (thisPlayer == null) return;
    socket.volatile.emit("playerStateUpdate", {sentAt: new Date().getTime(), actions: actions, rotation:thisPlayer.model.rotation, fps: $("#fps-counter").text(), 
    ping: $("#ping-counter").text() +"\t"+$("#packet-ping-counter").text() +"\t" + $("#shoot-ping-counter").text() } );
    counter++;
    if(counter == 2*configuration.sendingFrequency){
        const start = Date.now();
        socket.emit("ping", () => {
            const duration = Date.now() - start;
            $("#ping-counter").text("PING: "+duration);
        });
    }
}


var framerate = 60;
var frameClock = new THREE.Clock()
var deltaTime = 0;

var frameTime = 0;
const raycaster = new THREE.Raycaster();
const obstacleRaycaster = new THREE.Raycaster();

var lines =[];
var count=0;
var spectatingId;
var frameStart=new Date(), frameEnd=new Date();



function animate() {
    requestAnimationFrame(animate);
    deltaTime+=frameClock.getDelta();

    //draw--------------------------------------
    if(deltaTime > (1/framerate)){
        frameTime+=deltaTime;
        var interpolation = THREE.MathUtils.clamp((frameTime/(1/configuration.sendingFrequency)), 0, 1);
        for(let [id, p] of players){
            if(id == spectatingId)
                ammoElement.textContent =  p.mag+ "/" +p.ammo;
            
            p.model.position.lerpVectors(p.position.old, p.position.new, interpolation);

            if(id != player.id){
                p.model.rotation.x = THREE.MathUtils.lerp(p.rotation.old.x, p.rotation.new.x, interpolation);
                p.model.rotation.y = THREE.MathUtils.lerp(p.rotation.old.y, p.rotation.new.y, interpolation);
                p.model.rotation.z = THREE.MathUtils.lerp(p.rotation.old.z, p.rotation.new.z, interpolation);
            }

            if(p.dead){
                p.model.visible=false
            }
            for(let l of lines){
                l.duration-=deltaTime;
                l.line.material.opacity=((l.duration)/(0.4)*0.8)
            }
            lines = lines.filter(l=> l.duration>0);
            for(let s of p.shots){
                //console.log(s);
                const material = new THREE.LineBasicMaterial({
                    color: 0xFAF9F6,
                    transparent: true,
                    opacity: 0.8
                });
                
                const points = [];
                points.push( new THREE.Vector3( s.start.x,s.start.y,s.start.z ).add(new THREE.Vector3(-0.35, 0, 1.2).applyEuler(p.rotation.new)) );
                points.push( new THREE.Vector3( s.end.x,s.end.y,s.end.z ) );
                
                const geometry = new THREE.BufferGeometry().setFromPoints( points );

                const line = new THREE.Line( geometry, material );
                lines.push({line: line, duration:0.4});
                scene.add( line );
                p.model.children.find(x=> x.name="gunSound").stop();
                p.model.children.find(x=> x.name="gunSound").play();

                if(id == player.id){
                    if(fromClickToShoot.end == null && fromClickToShoot.clicked){
                        fromClickToShoot.end=new Date();
                        $("#shoot-ping-counter").text("Click-to-Shoot: "+(fromClickToShoot.end-fromClickToShoot.start));
                    }
                    ammoElement.textContent =  p.mag+"/"+p.ammo;
                }
            }
            p.shots = [];
            //adjust camera
            $("#"+id).find('.player-health')
            .css('width', ((p.health/p.attributes.maxHealth)*100)+"%")
            .text(p.health+"/"+p.attributes.maxHealth);
            if(/*id == player.id ||*/ id == spectatingId){

                var dir = new THREE.Vector3(0,0,0);
                if (actions.left)dir.add(new THREE.Vector3(configuration.direction.x, 0, configuration.direction.z).applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(90)));
                if (actions.right)dir.add(new THREE.Vector3(configuration.direction.x, 0, configuration.direction.z).applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(-90)));
                if (actions.forward)dir.add(new THREE.Vector3(configuration.direction.x, 0, configuration.direction.z))
                if (actions.backward)dir.add(new THREE.Vector3(-configuration.direction.x, 0, -configuration.direction.z))
                
                camera.position.addVectors(p.model.position, configuration.cameraOffset);
                camera.lookAt(p.model.position.x, p.model.position.y, p.model.position.z);
                raycaster.setFromCamera(pointer, camera);
                if(movedMouse && inFocus && p.id == player.id){
                    crosshair.position.x = mouse.x;
                    crosshair.position.y = mouse.y;
                    for (const iob of raycaster.intersectObject(aimplane)) {
                        aimingAt.set(iob.point.x, iob.point.z);
                    }
                    if(!p.dead)
                        p.model.lookAt(new THREE.Vector3(aimingAt.x, 0, aimingAt.y));
                    
                    movedMouse = false;
                }
                
                flatObjects.forEach(o => {
                    if(o.position.distanceTo(p.model.position)>=10 && o.object.material.opacity<=1){
                        o.object.visible = true;
                        o.object.material.opacity+=deltaTime*2;
                    }else if(o.object.material.opacity>0){
                        o.object.material.opacity-=deltaTime*2;
                        o.object.visible = o.object.material.opacity>0;
                    }
                })
                
            }
            p.mixer.update(deltaTime);
        }

        for(let [id, e] of enemies){

            e.model.position.lerpVectors(e.position.old, e.position.new, THREE.MathUtils.clamp(interpolation, 0, 1));
            e.model.rotation.x = THREE.MathUtils.lerp(e.rotation.old.x, e.rotation.new.x, interpolation);
            e.model.rotation.y = THREE.MathUtils.lerp(e.rotation.old.y, e.rotation.new.y, interpolation);
            e.model.rotation.z = THREE.MathUtils.lerp(e.rotation.old.z, e.rotation.new.z, interpolation);        

            e.mixer.update(deltaTime); 
            if(e.dead){
                var animationTime =  e.animationClock.getElapsedTime();
                if(animationTime>1){
                    scene.remove(e.model);
                    devScene.remove(e.path);
                    enemies.delete(id);
                }
                e.model.rotation.x = THREE.MathUtils.lerp(e.rotation.new.x, THREE.MathUtils.degToRad(90), e.animationClock.getElapsedTime());
                e.model.position.lerpVectors(e.position.new, new THREE.Vector3(e.position.new.x, -1, e.position.new.z), e.animationClock.getElapsedTime());
            }
        }
        deltaTime=0;

        renderer.clear();
        renderer.render(scene, (useDevCamera)?devCamera:camera);
        if(devMode){
            renderer.render(devScene,  (useDevCamera)?devCamera:camera);
        }
        renderer.clearDepth();
        renderer.render(sceneHud, cameraHud);
        frameEnd=frameStart;
        frameStart=new Date();
        $('#fps-counter').text("FPS:"+Math.trunc(1000/(frameStart.getTime()-frameEnd.getTime())))

    }

};


initSocket();

//all pressed keys
var keys = {}

function onKeyDown(ev) {
    keyPress(ev, true);
}
function onKeyUp(ev) {
    //console.log(players);
    keyPress(ev, false);
}
var devMode = false;
var useDevCamera = false;
function keyPress(ev, pressed) {
    if (keys[ev.key] != pressed) {
        //console.log((pressed) ? "press" : "release");
        //console.log(ev);
        switch (ev.code) {
            case 'KeyW':
                {
                    actions.forward = pressed;
                }; break;
            case 'KeyA':
                {
                    actions.left = pressed;
                }; break;
            case 'KeyS':
                {
                    actions.backward = pressed;
                }; break;
            case 'KeyD':
                {
                    actions.right = pressed;
                }; break;
            case 'KeyR':
                {
                    actions.reload = pressed;
                }; break;
            case 'Digit1':
                {
                    if(pressed)
                        socket.emit("upgrade", {gameId: gId, userId:player.id,  upgradeType: "maxHealth" });
                }; break;
            case 'Digit2':
                {
                    if(pressed)
                        socket.emit("upgrade", {gameId: gId, userId:player.id,  upgradeType: "speed" });
                }; break;
            case 'Digit3':
                {
                    if(pressed)
                        socket.emit("upgrade", {gameId: gId, userId:player.id,  upgradeType: "damage" });
                }; break;
            case 'Digit4':
                {
                    if(pressed)
                        socket.emit("upgrade", {gameId: gId, userId:player.id,  upgradeType: "firerate" });
                }; break;
            case 'Digit5':
                {
                    if(pressed)
                        socket.emit("upgrade", {gameId: gId, userId:player.id,  upgradeType: "magSize" });
                }; break;
            case 'F9':
                {
                    if(pressed){
                        devMode = !devMode;

                        players.forEach((p, id)=>{
                            p.model.traverse(c=> {
                                if(c.userData.debugObject){
                                    c.visible = devMode;
                                }
                            })
                        })
                        enemies.forEach((p)=>{
                            p.model.traverse(c=> {
                                if(c.userData.debugObject){
                                    c.visible = devMode;
                                }
                            })
                        })
                    }
                }; break;   
            case 'F8':
                {
                    if(pressed){
                        useDevCamera = !useDevCamera;
                    }
                }; break;   
            case 'escape':
                {
                    //console.log("esc");
                }; break;
            default:
                break;
        }
    }
    keys[ev.key] = pressed;
}