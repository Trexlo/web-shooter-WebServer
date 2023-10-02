
import { io } from 'socket.io-client';
import * as THREE from "three";
import * as  BufferGeometryUtils  from 'three/addons/utils/BufferGeometryUtils.js';
import 'jquery';
var area;
var nodeArea=0;
var lastNodeId=0;
class Node{
    constructor(id, x1, x2, z1, z2, obstacle=false, spawnNode=false, goalNode=false) {
        this.id = id;
        this.x1 = x1;
        this.x2 = x2;
        this.z1 = z1;
        this.z2 = z2;
        this.spawnNode = spawnNode;
        this.obstacle = obstacle;
        this.goalNode = goalNode;      
        this.box = new THREE.Box3();
        this.box.setFromPoints([
            new THREE.Vector3(x1, -1, z1),
            new THREE.Vector3(x1, 1, z1),
            new THREE.Vector3(x1, -1, z2),
            new THREE.Vector3(x1, 1, z2),
            new THREE.Vector3(x2, -1, z1),
            new THREE.Vector3(x2, 1, z1),
            new THREE.Vector3(x2, -1, z2),
            new THREE.Vector3(x2, 1, z2),
        ]);
        if(this.goalNode){
            var lmaterial = new THREE.LineDashedMaterial({
                color: 0x00ff00,
                linewidth: 1,
                scale: 1,
                dashSize: 3,
                gapSize: 2,
            });
            var lpoints = [];
            for(var i = x1, s=0; i <=x2; i+=0.3, s=(s+1)%2){
                if(s==0)
                    lpoints.push( new THREE.Vector3( i, -0.9, z1 ) );
                if(s==1)
                    lpoints.push( new THREE.Vector3( i, -0.9, z2 ) );
            }
            var lgeometry = new THREE.BufferGeometry().setFromPoints( lpoints );

            lpoints.push( new THREE.Vector3( x1, -0.9, z1 ) );
            lpoints.push( new THREE.Vector3( x1, -0.9, z2 ) );
            lpoints.push( new THREE.Vector3( x2, -0.9, z2 ) );
            lpoints.push( new THREE.Vector3( x2, -0.9, z1 ) );
            lpoints.push( new THREE.Vector3( x1, -0.9, z1 ) );
            var goalLine = new THREE.Line( lgeometry, lmaterial );
            goalLine.name="goalLine";
            scene.add( goalLine );
            
        }
        var boxcolor = 0x0000ff ^ 0xff00ff*obstacle;
        if(this.goalNode) boxcolor=0x00ff00;
        if(this.spawnNode) boxcolor=0xffff00
        this.helper = new THREE.Box3Helper( this.box, boxcolor  /*new THREE.Color().setRGB(Math.random(),Math.random(),Math.random()) */ );
        this.helper.userData.nodeId = id;
        this.helper.userData.node = true;

        gridScene.add(this.helper)
        if(!obstacle){
            const geometry = new THREE.SphereGeometry( 0.4, 32, 16 );
            const material = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
            this.helperSphere = new THREE.Mesh( geometry, material );
            this.helperSphere.position.set((x1+x2)/2,0,(z1+z2)/2)
            gridScene.add( this.helperSphere );
            nodeArea+=(x2-x1)*(z2-z1);
        }else {
            area-=(x2-x1)*(z2-z1);
        }

        this.center = {
            x: (x1+x2)/2,
            z: (z1+z2)/2
        }
    }
    id;
    neighbours= new Map();
    x1;x2;z1;z2;
    spawnNode=false;
    obstacle=false;
    goalNode=false;
    box;
    center;
    helper;
    helperSphere;
    toSendable(){
        console.log(Array.from(this.neighbours.entries()));
        return {
            id: this.id,
            neighbours: Array.from(this.neighbours.entries()),
            x1: this.x1,
            x2: this.x2,
            z1: this.z1,
            z2: this.z2,
            spawnNode: this.spawnNode,
            obstacle: this.obstacle,
            goalNode: this.goalNode,
            box: this.box,
            center: this.center
        }
    }
    removeFromScene(){
        if(this.helper) gridScene.remove(this.helper);
        if(this.helperSphere) gridScene.remove(this.helperSphere);
    }
}

var w = window.innerWidth;
var h = window.innerHeight;
var navMesh = {
    nodes: []
}
var addedObjects=[];
console.log(BufferGeometryUtils);
var scene = new THREE.Scene();
const sceneHud = new THREE.Scene();
const gridScene = new THREE.Scene();

var texLoader = new THREE.TextureLoader();

const templateScene = new THREE.Scene();
const placeHolderCamera = new THREE.PerspectiveCamera(75, w/h, 1, 2100);
placeHolderCamera.position.set(-3,3,3)
placeHolderCamera.lookAt(0,0,0)
var phcSize =0.9;
placeHolderCamera.setViewOffset(w*phcSize,h*phcSize,-w*phcSize/2 - w*phcSize*0.06,h*phcSize/2 - h*phcSize*0.1,w,h);

const camera = new THREE.PerspectiveCamera(75, 16 / 9, 1, 2100);
const cameraHud = new THREE.OrthographicCamera(- w / 2, w / 2, h / 2, - h / 2, 0.1, 10000);
cameraHud.left = - w / 2;
cameraHud.right = w / 2;
cameraHud.top = h / 2;
cameraHud.bottom = - h / 2;
cameraHud.updateProjectionMatrix();
cameraHud.position.z = 1000;


const renderer = new THREE.WebGLRenderer();

var dirAngle = new THREE.Euler(THREE.MathUtils.degToRad(0),THREE.MathUtils.degToRad(45),THREE.MathUtils.degToRad(0), 'XYZ');
var direction = new THREE.Vector3(1,0,0);
direction.applyEuler(dirAngle);

var cameraOffset = new THREE.Vector3(1, 0, 0);
var angle = new THREE.Euler(THREE.MathUtils.degToRad(0), THREE.MathUtils.degToRad(45+180), THREE.MathUtils.degToRad(65), 'XYZ');
cameraOffset.applyEuler(angle).multiplyScalar(10);
camera.position.set(0,0,0).add(cameraOffset);
var cameraLookAtPoint = new THREE.Vector3().copy(camera.position).sub(cameraOffset);
renderer.setSize(w, h);
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
document.getElementById("game").appendChild(renderer.domElement);
document.querySelectorAll("button").forEach( function(item) {
    item.addEventListener('focus', function() {
        this.blur();
    })
})
var move = {
    left: false,
    right: false,
    forward: false,
    backward: false,
    up: false,
    down: false,
    rotateLeft: false,
    rotateRight: false,
}
var planeSize = 100;
area = planeSize*planeSize;
var plane = new THREE.Mesh(new THREE.BoxGeometry(planeSize, 1, planeSize), new THREE.MeshStandardMaterial({color: 0xffffff, wireframe: false }));
plane.name="foundation"
plane.position.setY(-1.5);
plane.receiveShadow = true;

const size = 101;
const divisions = 101;
var gridHelper = new THREE.GridHelper(size, divisions);
gridHelper.position.y = -1;
gridHelper.position.x = 0;
//gridScene.add(gridHelper);
const placePlaneGeometry = new THREE.PlaneGeometry( 100, 100 );
const placePlaneMaterial = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide, visible: false, transparent:true, opacity: 0.4} );
const placePlane = new THREE.Mesh( placePlaneGeometry, placePlaneMaterial );
placePlane.rotateOnAxis(new THREE.Vector3(1,0,0), THREE.MathUtils.degToRad(90));
placePlane.position.y = -1;
placePlane.position.x = 0;
placePlane.name = "foundation";
console.log(placePlane);
scene.add( placePlane );
var saveScene = new THREE.Scene();

const mouse = new THREE.Vector2();
const pointer = new THREE.Vector2();
const aimingAt = new THREE.Vector2();

var inFocus = false;
var templateGroup = new THREE.Group();
var templateGeometry = new THREE.BoxGeometry(1, 1, 1);
var templateMaterial = new THREE.MeshStandardMaterial({map:null, transparent:true, opacity: 1, color: 0xffffff, wireframe:false});
var templateCube = new THREE.Mesh(templateGeometry, templateMaterial);
templateCube.castShadow = true; //default is false
templateCube.receiveShadow = false; //default

var templateCubeAttributes = {
    posX:0,
    posZ:0,
    width:1,
    depth:1,
}
templateGroup.add(templateCube);

const box = new THREE.Box3();
box.setFromCenterAndSize( templateCube.position, new THREE.Vector3( 1, 1, 1 ) );

const templateHelper = new THREE.Box3Helper( box, 0xffff00 );


templateGroup.add( templateHelper );
templateGroup.position.set(0,0,0)
templateGroup.position.set(0,0,0)
templateScene.add(templateGroup);

var undo = [];
var lastSelected = null;
var lastSelectedOriginalMaterial = null;
var lastShift = shift;
var spawnPoint = {
    area:null,
    point: new THREE.Vector3(0,0,0),
    indicator: new THREE.PointLight( 0xffff00, 1, 10 )
    
};
var goal = {
    area:null,
    point: null,
    indicator: new THREE.PointLight( 0x00ff00, 1, 10 )
};

spawnPoint.indicator.shadowMapVisible = true;
spawnPoint.indicator.position.set(0,1,0);
gridScene.add( spawnPoint.indicator ); 
const sphereSize = 3;
const spawnPointHelper = new THREE.PointLightHelper( spawnPoint.indicator, sphereSize );
spawnPointHelper.color=0xffff00;
gridScene.add( spawnPointHelper );

gridScene.add( goal.indicator ); 
const goalHelper = new THREE.PointLightHelper( goal.indicator, sphereSize );
goalHelper.color=0x00ff00;
gridScene.add( goalHelper );
goalHelper.visible=false;


const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.4);
directionalLight.position.set(planeSize/2,planeSize/2,planeSize/2)
directionalLight.castShadow = true;
directionalLight.shadow.camera.far = 1000000;
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.top = -planeSize/2;
directionalLight.shadow.camera.left = -planeSize/2;
directionalLight.shadow.camera.bottom = planeSize/2;
directionalLight.shadow.camera.right = planeSize/2;
directionalLight.shadow.mapSize = new THREE.Vector2(4096,4096);
directionalLight.shadow.normalBias=0.1;
scene.add( directionalLight );
templateScene.add( directionalLight.clone());

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add( ambientLight.clone());
templateScene.add( ambientLight.clone());
gridScene.add(ambientLight.clone());

const raycaster = new THREE.Raycaster();
const zCaster = new THREE.Raycaster();

var buildingCube = new THREE.Mesh(templateGeometry.clone(), templateMaterial.clone()); 
buildingCube.material.opacity =0.5
gridScene.add(buildingCube);

var selectedObject = null;

var speed = 5;// u/s
var clock = new THREE.Clock();
var frameClock = new THREE.Clock();
var frameDelta = 0;
var drawDelta = 0;
var packetDelta = 0;
let fps = 60;
let interval = 1 / fps;
let mode = "place";
document.getElementById(mode).hidden=true;

async function init(){
    var createType=new URLSearchParams(window.location.search).get("type")
    var mapId = new URLSearchParams(window.location.search).get("id");
    var mapVersion = new URLSearchParams(window.location.search).get("version");
    if(createType == "edit"){
        var data = await fetch('/createMap',{

            method:'POST',
            headers:{
                "Content-Type": "application/json"
            },
            body:JSON.stringify({
                mapId:mapId,
                version:mapVersion
            }),
        });
        console.log(data);
        var jsonData = await data.json();
        console.log(jsonData);
        document.getElementById("name").value = jsonData.map.name;
        document.getElementById("name").setAttribute("readonly", "true");
        document.getElementById("maptype").value = jsonData.map.type;
        document.getElementById("maptype").setAttribute("disabled", "true");
        mapType = jsonData.map.type;
        scene = await (new THREE.ObjectLoader()).parseAsync(jsonData.map.data.map);
        console.log(scene);
        plane = scene.children.find(x=>x.name=="foundation");

        var sizeVec = new THREE.Vector3();
        plane.geometry.computeBoundingBox()
        plane.geometry.boundingBox.getSize(sizeVec);
        plane.receiveShadow=true;
        planeSize = sizeVec.x;
        gridHelper = new THREE.GridHelper(planeSize+1, planeSize+1);
        gridHelper.position.y = -1;
        gridHelper.position.x = 0;
        gridScene.add(gridHelper);
        jsonData.map.data.navmesh.filter(n=>n.obstacle).forEach(a=>{
            if(lastNodeId<a.id)lastNodeId=a.id;
            navMesh.nodes.push(
                new Node(
                   // box: Object { isBox3: true, min: {…}, max: {…} }​​​​​
                   // center: Object { x: 50.5, z: 0 }​​​​​
                   // goalNode: false​​​​​
                   // id: 0​​​​​
                   // neighbours: Array []​​​​​
                   // obstacle: true​​​​​
                   // spawnNode: false​​​​​
                   // x1: 50​​​​​
                   // x2: 51​​​​​
                   // z1: -51​​​​​
                   // z2: 51
                   a.id,
                   a.x1,
                   a.x2,
                   a.z1,
                   a.z2,
                   a.obstacle,
                   a.spawnNode,
                   a.goalNode
                )
            )
        });
        var spawnNode = jsonData.map.data.navmesh.find(n=>n.spawnNode);
        spawnPoint.point = new THREE.Vector3(spawnNode.center.x, 1, spawnNode.center.z);
        spawnPoint.indicator.position.copy(spawnPoint.point)
        if(jsonData.map.type == "campaign"){
            var goalNode = jsonData.map.data.navmesh.find(n=>n.goalNode);
            goal.point = new THREE.Vector3(goalNode.center.x, 1, goalNode.center.z);
            goal.indicator.position.copy(goal.point)
        }else{
            goalHelper.visible= false;
            document.getElementById("goal").hidden = true;
        }
        scene.add( placePlane );
        lastNodeId++;
        console.log("new node id "+lastNodeId);
    }else
    if(createType == "createNew"){
        // $('#prompt').show();
        $("body").find("*").addClass("hidden-element");
        $("#plane-size-prompt").css("display","flex")
        $("#plane-size-prompt").find("*").css("display","block")
       //wait for input
    }else{
        document.write("error");
    }

}
init();

document.getElementById("fps").onchange = changeFPS;
document.getElementById("openSave").onclick= ()=>{
    $("#save-map-prompt").css("display","flex")
}
document.getElementById("cancelBtn").onclick= ()=>{
    $("#save-map-prompt").css("display","none")
}
document.getElementById("plane-size-button").onclick = ()=>{
    var size = Number.parseInt($("#plane-size").val());
    planeSize = size;
    area = planeSize*planeSize;
    plane = new THREE.Mesh(new THREE.BoxGeometry(planeSize, 1, planeSize), new THREE.MeshStandardMaterial({color: 0xffffff, wireframe: false }));
    plane.name="foundation"
    plane.position.setY(-1.5);
    plane.receiveShadow = true;

    scene.add(plane);
    gridHelper = new THREE.GridHelper(size+1, size+1);
    gridHelper.position.y = -0.99;
    gridHelper.position.x = 0;
    gridScene.add(gridHelper);

    navMesh.nodes.push(
        new Node(lastNodeId++, planeSize/2, planeSize/2 + 1, -planeSize/2 - 1, planeSize/2 + 1, true, false, false)
    );
    navMesh.nodes.push(
        new Node(lastNodeId++, -planeSize/2-1, -planeSize/2, -planeSize/2 - 1, planeSize/2 + 1, true, false, false)
    );
    navMesh.nodes.push(
        new Node(lastNodeId++, -planeSize/2 - 1, planeSize/2 + 1,  planeSize/2, planeSize/2 + 1, true, false, false)
    );
    navMesh.nodes.push(
        new Node(lastNodeId++, -planeSize/2 - 1, planeSize/2 + 1,  -planeSize/2-1, -planeSize/2, true, false, false)
    );

    $("body").find("*").removeClass("hidden-element");
    $("#plane-size-prompt").css("display","none")
};

document.getElementById("width").oninput = (ev)=>{
    var val = ev.target.valueAsNumber;
    templateCube.scale.setX(THREE.MathUtils.clamp(val, 0.1, 1));

    templateCubeAttributes.width=THREE.MathUtils.clamp(val, 0.1, 1)

    document.getElementById("posX").setAttribute("min", ((val-1)/2).toString())
    document.getElementById("posX").setAttribute("max", (-(val-1)/2).toString())
    templateCube.position.setX(0);
    templateCubeAttributes.posX=0;
    changeBuildingCube()
};
document.getElementById("depth").oninput = (ev)=>{
    var val = ev.target.valueAsNumber;
    templateCube.scale.setZ(THREE.MathUtils.clamp(val, 0.1, 1));

    templateCubeAttributes.depth=THREE.MathUtils.clamp(val, 0.1, 1)

    document.getElementById("posZ").setAttribute("min", ((val-1)/2).toString())
    document.getElementById("posZ").setAttribute("max", (-(val-1)/2).toString())
    // document.getElementById("posZ").setAttribute("value", "0.0")
    templateCube.position.setZ(0);
    templateCubeAttributes.posZ=0;
    changeBuildingCube();
};
document.getElementById("posX").oninput = (ev)=>{
    console.log(templateCube.position);
    var val = ev.target.valueAsNumber;
    templateCube.position.setX(THREE.MathUtils.clamp(val, (templateCubeAttributes.width-1)/2, -(templateCubeAttributes.width-1)/2));
    templateCubeAttributes.posX = THREE.MathUtils.clamp(val, (templateCubeAttributes.width-1)/2, -(templateCubeAttributes.width-1)/2);
    console.log(templateCube.position);

    changeBuildingCube();
};
document.getElementById("posZ").oninput = (ev)=>{
    var val = ev.target.valueAsNumber;
    templateCube.position.setZ(THREE.MathUtils.clamp(val, (templateCubeAttributes.depth-1)/2, -(templateCubeAttributes.depth-1)/2));
    templateCubeAttributes.posZ = THREE.MathUtils.clamp(val, (templateCubeAttributes.depth-1)/2, -(templateCubeAttributes.depth-1)/2);
    console.log(templateCube.position);

    changeBuildingCube();
};
document.getElementById("texSelect").onchange = (ev)=>{
    if(ev.target.value == "none"){
        document.getElementById("texSelect-image").src="";
        templateCube.material.map = null
        templateCube.material.needsUpdate = true;
        buildingCube.material.map = null;
        buildingCube.material.needsUpdate = true;
    }else{
        document.getElementById("texSelect-image").src=ev.target.value;
        texLoader.loadAsync(ev.target.value).then(tex=>{
            tex.wrapS = THREE.MirroredRepeatWrapping;
            tex.wrapT = THREE.MirroredRepeatWrapping;
            templateCube.material.map = tex;
            templateCube.material.needsUpdate = true;
            buildingCube.material.map = tex;
            buildingCube.material.needsUpdate = true;

        })
        
    }
    changeBuildingCube();
};
var color={
    r:256,
    g:256,
    b:256
}
document.getElementById("colorR").oninput = (ev)=>{
    var val = THREE.MathUtils.clamp(ev.target.valueAsNumber, 0, 256);
    color.r=val;
    changeColor();
};
document.getElementById("colorG").oninput = (ev)=>{
    var val = THREE.MathUtils.clamp(ev.target.valueAsNumber, 0, 256);
    color.g=val;
    changeColor();
};
document.getElementById("colorB").oninput = (ev)=>{
    var val = THREE.MathUtils.clamp(ev.target.valueAsNumber, 0, 256);
    color.b=val;
    changeColor();
};
function changeColor(){
    templateCube.material.color.setRGB(color.r/256, color.g/256, color.b/256);
    changeBuildingCube();
}


document.getElementById("foundation-texSelect").onchange = (ev)=>{
    if(ev.target.value == "none"){
        plane.material.map = null
        plane.material.needsUpdate = true;
    }else{
        texLoader.loadAsync(ev.target.value).then(tex=>{
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set( planeSize, planeSize );
            plane.material.map = tex;
            plane.material.needsUpdate = true;
        })
    }
};
var foundationColor={
    r:256,
    g:256,
    b:256
}
document.getElementById("foundation-colorR").oninput = (ev)=>{
    var val = THREE.MathUtils.clamp(ev.target.valueAsNumber, 0, 256);
    foundationColor.r=val;
    changePlaneLook();
};
document.getElementById("foundation-colorG").oninput = (ev)=>{
    var val = THREE.MathUtils.clamp(ev.target.valueAsNumber, 0, 256);
    foundationColor.g=val;
    changePlaneLook();
};
document.getElementById("foundation-colorB").oninput = (ev)=>{
    var val = THREE.MathUtils.clamp(ev.target.valueAsNumber, 0, 256);
    foundationColor.b=val;
    changePlaneLook();
};
function changePlaneLook(){
    plane.material.color.setRGB(foundationColor.r/256, foundationColor.g/256, foundationColor.b/256);
}
function changeBuildingCube(){
    buildingCube.scale.setX(templateCubeAttributes.width)
    buildingCube.scale.setZ(templateCubeAttributes.depth)
    buildingCube.geometry = templateGeometry.clone();
    buildingCube.material = templateMaterial.clone();
    buildingCube.material.opacity=0.5;
    buildingCube.material.needsUpdate=true;
}
function changeFPS(ev) {
    fps = Number.parseInt(ev.target.value)
    interval = 1 / fps;
    console.log(fps);
}

var interpolationFactor = 0;
var cameraCirclePoint = 0;

function animate() {
    requestAnimationFrame(animate);
    drawDelta += frameClock.getDelta();
    raycaster.setFromCamera(pointer, camera);

    if (drawDelta > interval) {
        var deltaTime = clock.getDelta();

        frameDelta += deltaTime;
        var first = raycaster.intersectObject(scene)[0];
        //console.log(first);
        if(first != undefined){
            if(mode == "place"){
                if(first.face != null){
                    buildingCube.position.copy( first.point )
                    .setY(Math.floor(buildingCube.position.y))
                    .round()
                    .add(new THREE.Vector3(0,0.5,0))
                    .add( first.face.normal.clamp(new THREE.Vector3(-1,-1,-1), new THREE.Vector3(0,0,0)) )
                    .add(new THREE.Vector3(templateCubeAttributes.posX, 0, templateCubeAttributes.posZ))
                    .clamp(new THREE.Vector3(-((planeSize/2) -1),-0.5,-((planeSize/2) -1)), new THREE.Vector3(((planeSize/2) -1),100,((planeSize/2) -1)))
                    if(shift){
                        if(shiftPlacing.startPosition!=null){
                            if(shiftPlacing.state==1)
                                buildingCube.position.setY(shiftPlacing.startPosition.y);
                        }
                        if(shiftPlacing.direction!=null){
                            if(shiftPlacing.direction.x == 0){
                                buildingCube.position.setX(shiftPlacing.startPosition.x);
                            }
                            if(shiftPlacing.direction.z == 0){
                                buildingCube.position.setZ(shiftPlacing.startPosition.z);
                            }
                        }
                    }


                }

            }
            if(mode == "erase" || (mode== "move" && selectedObject == null)){
                if(lastSelected == null || lastSelected.id != first.object.id || lastShift!=shift){
                    if(lastSelected!=null) {
                        if(lastSelected.type=="Group"){
                            lastSelected.traverse(c=> {if(c.isMesh) c.material.opacity=1});
                        }else{
                            lastSelected.material.opacity = 1;
                        }
                    }
                    if(first.object.parent.type=="Group" && shift){
                        lastSelected=first.object.parent;
                    }else{
                        lastSelected=first.object;
                    }
                    lastShift=shift;
                }
                if(first.object.parent.type=="Group" && shift){
                    first.object.parent.traverse(c=> {if(c.isMesh) c.material.opacity=0.5});
                }else{
                    first.object.material.opacity=0.5;
                }
            }
            if(selectedObject!=null){
                selectedObject.position.copy( first.point )
                    .round()
                    .add(new THREE.Vector3(0,0.5,0))
                    .add( first.face.normal.clamp(new THREE.Vector3(-1,-1,-1), new THREE.Vector3(0,0,0)) )
                    .clamp(new THREE.Vector3(-((planeSize/2) -1),-0.5,-((planeSize/2) -1)), new THREE.Vector3(((planeSize/2) -1),100,((planeSize/2) -1)))
            }
            if(mode == "spawn"){
                spawnPoint.indicator.position.copy(first.point).round().setY(1);
                spawnPoint.point = spawnPoint.indicator.position;
            }
            if(mode == "goal"){
                goal.indicator.position.copy(first.point).round().setY(1);
                goal.point = goal.indicator.position;
            }
            if(mode == "edit" ){
                if(lastSelected == null || lastSelected.id != first.object.id || lastShift!=shift){
                    if(lastSelected!=null && lastSelectedOriginalMaterial!=null) {
                        if(lastSelected.type=="Group"){
                            lastSelected.traverse(c=> {if(c.isMesh) {
                                if(lastSelectedOriginalMaterial.has(c.id)){
                                    c.material = lastSelectedOriginalMaterial.get(c.id).clone();
                                }
                                c.material.opacity=1
                            }});
                        }else{
                            lastSelected.material = lastSelectedOriginalMaterial.clone()
                            lastSelected.material.opacity = 1;
                        }
                        lastSelectedOriginalMaterial=null;
                    }
                    if(first.object.parent.type=="Group" && shift){
                        lastSelected=first.object.parent;
                        if(lastSelectedOriginalMaterial == null){
                            lastSelectedOriginalMaterial = new Map();
                            lastSelected.traverse(c=> {if(c.isMesh) {
                                lastSelectedOriginalMaterial.set(c.id, c.material.clone());
                            }});
                        }
                    }else{
                        lastSelected=first.object;
                        if(lastSelectedOriginalMaterial == null)
                            lastSelectedOriginalMaterial = first.object.material.clone();
                    }
                    lastShift=shift;
                }
                if(first.object.name!="foundation" && first.object.name!="goalLine"){
                    if(first.object.parent.type=="Group" && shift){
                        first.object.parent.traverse(c=> {if(c.isMesh) {
                            c.material = templateCube.material.clone();
                            c.material.opacity=0.5}
                        });
                    }else{
                        first.object.material = templateCube.material.clone();
                        first.object.material.opacity=0.5;
                    }
                }

            }
        }

        var cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.setY(0);
        cameraDirection.normalize();

        if (move.left){
            camera.position.addScaledVector(new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(90)), speed * deltaTime);
            cameraLookAtPoint.addScaledVector(new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(90)), speed * deltaTime);
            //directionalLight.position.addScaledVector(new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(90)), speed * deltaTime);
        } 
        if (move.right){
            camera.position.addScaledVector(new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(-90)), speed * deltaTime);
            cameraLookAtPoint.addScaledVector(new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(-90)), speed * deltaTime);
            //directionalLight.position.addScaledVector(new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(-90)), speed * deltaTime);
        } 
        if (move.forward){
            camera.position.addScaledVector(new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z), speed * deltaTime);
            cameraLookAtPoint.addScaledVector(new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z), speed * deltaTime);
            //directionalLight.position.addScaledVector(new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z), speed * deltaTime);
        } 
        if (move.backward){
            camera.position.addScaledVector(new THREE.Vector3(-cameraDirection.x, 0, -cameraDirection.z), speed * deltaTime);
            cameraLookAtPoint.addScaledVector(new THREE.Vector3(-cameraDirection.x, 0, -cameraDirection.z), speed * deltaTime);
            //directionalLight.position.addScaledVector(new THREE.Vector3(-cameraDirection.x, 0, -cameraDirection.z), speed * deltaTime);
        } 

        if (move.up){
            cameraOffset.addScaledVector(cameraOffset.clone().normalize(), speed * deltaTime);
            camera.position.copy(new THREE.Vector3().copy(cameraLookAtPoint).add(cameraOffset));
        
        } 
        if (move.down){      
            cameraOffset.addScaledVector(cameraOffset.clone().normalize(), -speed * deltaTime);
            camera.position.copy(new THREE.Vector3().copy(cameraLookAtPoint).add(cameraOffset));
        
        } 

        if (move.rotateLeft) {
            cameraOffset.applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(1));
            camera.position.copy(new THREE.Vector3().copy(cameraLookAtPoint).add(cameraOffset));
        }
        if (move.rotateRight) {
            cameraOffset.applyAxisAngle(new THREE.Vector3(0,1,0), THREE.MathUtils.degToRad(-1));
            camera.position.copy(new THREE.Vector3().copy(cameraLookAtPoint).add(cameraOffset));
        }

        camera.lookAt(cameraLookAtPoint);

        renderer.clear();
        renderer.render(templateScene, placeHolderCamera);
        renderer.render(scene, camera);
        renderer.render(gridScene, camera);
        
        renderer.clearDepth();
        renderer.render(sceneHud, cameraHud);
        //console.log(navMesh.nodes);
        interpolationFactor = THREE.MathUtils.clamp(1 - ((packetDelta - frameDelta) / packetDelta), 0.0, 1.0);

        drawDelta = drawDelta % interval;
    }
}
var shiftPlacing={
    state:0,//0-first block 1- last block 2- height
    positions:[],
    startPosition:null,
    currentPosition:null,
    lastPosition:null,
    endPosition:null,
    endY:null,
    direction:null,
    blocks:[],
    vertices:[],
    block:null
};
var click = false;
renderer.domElement.addEventListener("mousemove", (ev) => {

    if (shift && mode == "place"){
  
        if(shiftPlacing.state==1){
            shiftPlacing.currentPosition=buildingCube.position.clone();

            if(shiftPlacing.startPosition!=null && !shiftPlacing.currentPosition.equals(shiftPlacing.startPosition)){//clamp direction
                shiftPlacing.direction=new THREE.Vector3().copy(buildingCube.position.clone()).sub(shiftPlacing.startPosition).normalize();   
                if(!shiftPlacing.direction.equals(new THREE.Vector3(1,0,0)) 
                && !shiftPlacing.direction.equals(new THREE.Vector3(-1,0,0)) 
                && !shiftPlacing.direction.equals(new THREE.Vector3(0,0,1)) 
                && !shiftPlacing.direction.equals(new THREE.Vector3(0,0,-1))){
                    shiftPlacing.direction = new THREE.Vector3(1,0,0);
                }
            }
            if(shiftPlacing.startPosition==null){//clamp y
                shiftPlacing.startPosition=buildingCube.position.clone();   
                gridHelper.position.setY(shiftPlacing.startPosition.y-0.49);
                placePlane.position.setY(shiftPlacing.startPosition.y-0.5);
            }
            if(shiftPlacing.currentPosition.equals(shiftPlacing.startPosition)){//clamp y
                shiftPlacing.direction=null;

            }
            var currCube=shiftPlacing.blocks.findIndex(b=>b.position.equals(shiftPlacing.lastPosition));

            if(shiftPlacing.lastPosition != null && shiftPlacing.direction != null && currCube!=-1 && (new THREE.Vector3().copy(shiftPlacing.lastPosition).sub(shiftPlacing.direction)).equals(shiftPlacing.currentPosition)){
                gridScene.remove(shiftPlacing.blocks.splice(currCube,1)[0]);
            }else
            if(shiftPlacing.lastPosition==null || !shiftPlacing.currentPosition.equals(shiftPlacing.lastPosition)){
                shiftPlacing.endPosition = buildingCube.position.clone();
                var newC = buildingCube.clone();
                shiftPlacing.blocks.push(newC);
                gridScene.add(newC);
            }

            shiftPlacing.lastPosition=shiftPlacing.currentPosition.clone();
            
        }
        if(shiftPlacing.state==2){
            shiftPlacing.blocks.forEach(b=>gridScene.remove(b));
            shiftPlacing.blocks=[];
            var dy=(shiftPlacing.startPosition.y<=buildingCube.position.y)?1:-1;
            for(var y = shiftPlacing.startPosition.y; true; y+=dy){
                for(var i = shiftPlacing.startPosition.clone(); !shiftPlacing.startPosition.equals(shiftPlacing.endPosition); i.add(shiftPlacing.direction)){
                    var newC = buildingCube.clone();
                    newC.geometry = buildingCube.geometry.clone();
                    newC.material= buildingCube.material.clone();
                    newC.position.copy(i);
                    newC.position.setY(y);
                    if(!shiftPlacing.blocks.find(x=>x.position.equals(newC.position))){
                        shiftPlacing.blocks.push(newC);
                        gridScene.add(newC);
                    }
                    
                    if(i.equals(shiftPlacing.endPosition))break;
                }
                if(y==buildingCube.position.y)break;
            }
        }
    }
    
    
});
renderer.domElement.addEventListener("mousedown", (ev) => {
    console.log(shiftPlacing);
    if(ev.button==1){
        var rc = new THREE.Raycaster();
        rc.setFromCamera(pointer, camera);
        console.log();
        var b = rc.intersectObject(gridScene)
        var c=b[b.length-1];
        console.log(buildingCube.position);
        if(c!=undefined){
            console.log(c.point);
            console.log(c.object);
            var selected =navMesh.nodes.find(n => !n.obstacle && buildingCube.position.x > n.x1 && buildingCube.position.x < n.x2 && buildingCube.position.z > n.z1 && buildingCube.position.z < n.z2 );
            console.log(selected);
            if(shift && selected!=undefined)generateNavMeshRecursiveMath(selected, true);
        } 
    };
    if(ev.button!=0)return;
    click=true;
    if(mode == "erase" && lastSelected.name != "foundation" &&  lastSelected.name!="goalLine"){
        console.log(lastSelected);
        if(lastSelected.parent && lastSelected.parent.type=="Group"){
            if(lastSelected.userData.nodes!=undefined   && lastSelected.position.y<=1 ){
                for(var n of lastSelected.userData.nodes){
                    var node = navMesh.nodes.find(x=> x.id == n);
                    if(node){    
                        gridScene.remove(node.helper)
                        if(node.sphereHelper)
                            gridScene.remove(node.sphereHelper)
                        navMesh.nodes.splice(navMesh.nodes.findIndex(u=> u.id == n), 1);
                    }
                }
            }
            lastSelected.parent.remove(lastSelected)
            undo.splice(undo.findIndex(u=> u.id == lastSelected.id), 1);
        }else{
            if(lastSelected.userData.nodes!=undefined){
                for(var n of lastSelected.userData.nodes){
                    var node = navMesh.nodes.find(x=> x.id == n);
                    if(node){
                        gridScene.remove(node.helper)
                        if(node.sphereHelper)
                            gridScene.remove(node.sphereHelper)
                        navMesh.nodes.splice(navMesh.nodes.findIndex(u=> u.id == n), 1);
                    }
                }
            }
            scene.remove(lastSelected)
            undo.splice(undo.findIndex(u=> u.id == lastSelected.id), 1);
        }
        
    }
    if(mode == "edit" && lastSelected.name != "foundation" && lastSelected.name!="goalLine"){

        lastSelectedOriginalMaterial=null;
        lastSelected=null;
        
    }
    if(!shift){
        if(mode == "place"){
            var newC = templateCube.clone();
            newC.geometry = templateCube.geometry.clone();
            newC.material= templateCube.material.clone();
            newC.position.copy(buildingCube.position)
            newC.castShadow=true;
            newC.receiveShadow=true;
            console.log(buildingCube.position.y);
            newC.userData.nodes=[]
            if(buildingCube.position.y<=1){
                navMesh.nodes.push(
                    new Node(lastNodeId,
                        /*x1=*/ buildingCube.position.x - templateCubeAttributes.width/2,
                        /*x2=*/ buildingCube.position.x + templateCubeAttributes.width/2,
                        /*z1=*/ buildingCube.position.z - templateCubeAttributes.depth/2,
                        /*z2=*/ buildingCube.position.z + templateCubeAttributes.depth/2,
                        buildingCube.position.y<=1,
                        false,
                        false)                 
                );
                newC.userData.nodes=[lastNodeId];
                lastNodeId++;
            }
            console.log(templateCubeAttributes);
            scene.add(newC)
            addedObjects.push(newC);
            undo.push(newC);
        }
       
        if(mode == "move" &&  lastSelected.name != "foundation" && lastSelected.name!="goalLine"){
            if(selectedObject==null){
                console.log("no select");
                if(lastSelected.parent.type=="Group"){
                    selectedObject = lastSelected.parent.clone();
                    console.log(selectedObject);
                    scene.remove(lastSelected.parent);
                    gridScene.add(selectedObject);
                }else{
                    selectedObject = lastSelected.clone();
                    console.log(selectedObject);
                    scene.remove(lastSelected);
                    gridScene.add(selectedObject);
                }
            }else{
                console.log("selected - setting");
                scene.add(selectedObject);
                var dxdydz = new THREE.Vector3().subVectors(selectedObject.position, lastSelected.position);
                for(var n of selectedObject.userData.nodes){
                    var node = navMesh.nodes.find(x=> x.id == n);
                    if(node){
                        gridScene.remove(node.helper)
                        if(node.sphereHelper)
                        gridScene.remove(node.sphereHelper)
                        navMesh.nodes.splice(navMesh.nodes.findIndex(u=> u.id == n), 1);
                    }

                }
                selectedObject.userData.nodes = [];
                if(selectedObject.position.y<=1){
                    console.log(selectedObject);

                    var objects=[];
                    if(selectedObject.type == "Group") objects = selectedObject.children;
                    else objects=[selectedObject];
                    for(var o of objects){
                        o.geometry.computeBoundingBox();
                        var size = new THREE.Vector3();
                        var center = new THREE.Vector3();
                        o.geometry.boundingBox.getSize(size);
                        o.geometry.boundingBox.getCenter(center);
                        var dx=0,dz=0;
                        if(selectedObject.type == "Group"){
                            dx=selectedObject.position.x;
                            dz=selectedObject.position.z;
                        }
                        console.log(selectedObject.position.y+"+"+o.position.y);
                        if(selectedObject.position.y+o.position.y<=1){
                            navMesh.nodes.push(
                                new Node(lastNodeId,
                                    /*x1=*/ o.position.x+dx - ((size.x/2)*o.scale.x) + center.x,
                                    /*x2=*/ o.position.x+dx + ((size.x/2)*o.scale.x) + center.x,
                                    /*z1=*/ o.position.z+dz - ((size.z/2)*o.scale.z) + center.z,
                                    /*z2=*/ o.position.z+dz + ((size.z/2)*o.scale.z) + center.z,
                                    true,
                                    false,
                                    false)                 
                            );
                            
                            o.userData.nodes.push(lastNodeId);
                            selectedObject.userData.nodes.push(lastNodeId);
                            lastNodeId++;
                        }else o.userData.nodes = []
                    }
                    
                }
                gridScene.remove(selectedObject);
                selectedObject=null;
            }
        }
        if(mode == "spawn" || mode == "goal"){
            
            switchMode("place");
        }
    }else if(mode=="place"){
        shiftPlacing.state+=1;
        if(shiftPlacing.state==2){
            placePlane.rotation.setFromVector3((shiftPlacing.direction.clone().multiplyScalar(THREE.MathUtils.degToRad(90))))
            placePlane.rotateOnAxis(new THREE.Vector3(1,0,0), THREE.MathUtils.degToRad(90));
            placePlane.position.copy(shiftPlacing.startPosition);
            gridHelper.rotation.setFromVector3((shiftPlacing.direction.clone().multiplyScalar(THREE.MathUtils.degToRad(90))))
            gridHelper.position.copy(shiftPlacing.startPosition);
        }
        if(shiftPlacing.state==3){
            shiftPlacing.endY = buildingCube.position.y;
        }
    }

});
renderer.domElement.addEventListener("mouseup", (ev) => {
    if (inFocus){
        actions.fire=false;
    }
    if(shiftPlacing.startPosition!=null && shiftPlacing.state==3){
                        
        gridHelper.position.set(0,-0.99,0);
        gridHelper.rotation.set(0,0,0);
        placePlane.rotation.set(THREE.MathUtils.degToRad(90),0,0);
        placePlane.position.set(0, -1, 0);
        var tmpBlocks = [];
        shiftPlacing.direction = shiftPlacing.endPosition.clone().sub(shiftPlacing.startPosition).normalize();
        var nodeIds=[];
        var dy=(shiftPlacing.startPosition.y<=shiftPlacing.endY)?1:-1;
        for(var y=shiftPlacing.startPosition.y; true; y+=dy ){
            for(var i = shiftPlacing.startPosition.clone(); !shiftPlacing.startPosition.equals(shiftPlacing.endPosition); i.add(shiftPlacing.direction)){
                var newC = templateCube.clone();
                newC.geometry = templateCube.geometry.clone();
                newC.material= templateCube.material.clone();
                newC.position.copy(i);
                newC.position.setY(y);
                newC.castShadow=true;
                newC.receiveShadow=true;
                newC.removeFromParent();
                tmpBlocks.push(newC);
                if(y<=1){
                    newC.userData.nodes=[lastNodeId];
                    nodeIds.push(lastNodeId);
                    navMesh.nodes.push(
                        new Node(
                            lastNodeId,
                            /*x1=*/ i.x - templateCubeAttributes.width/2,
                            /*x2=*/ i.x + templateCubeAttributes.width/2,
                            /*z1=*/ i.z - templateCubeAttributes.depth/2,
                            /*z2=*/ i.z + templateCubeAttributes.depth/2,
                            y<=1,
                            false,
                            false
                        )
                    )
                    lastNodeId++;
                }else newC.userData.nodes=[];

                
                if(i.equals(shiftPlacing.endPosition))break;
            }
            if(y==buildingCube.position.y)break;
        }
        
       
        shiftPlacing.blocks.forEach(b=>gridScene.remove(b))

        var newC = new THREE.Group();
   
        var first = tmpBlocks[0].position.clone();

        for(var v of tmpBlocks)
        {
            v.position.sub(first);
            var x = v.clone();
            newC.add(x);
            //scene.add(x);
            x.parent=newC;
        }
        console.log(newC);
        console.log("END");
        newC.position.copy(first)
        newC.castShadow=true;
        newC.receiveShadow=true;
        newC.userData.nodes = nodeIds;
        scene.add(newC);
        addedObjects.push(newC);
        undo.push(newC);
        shiftPlacing={
            state:0,
            positions:[],
            direction:null,
            startPosition:null,
            blocks:[],
            vertices:[],
            block:null
        };
    }

    

    click=false;
});

renderer.domElement.addEventListener("click", (ev) => {

});

document.addEventListener("pointerlockchange", (ev) => {
    
    console.log("plc");
    console.log(document.pointerLockElement == renderer.domElement);
    inFocus = document.pointerLockElement == renderer.domElement;
});
renderer.domElement.addEventListener("pointermove", (ev) => {
    if(inFocus){
        mouse.x += (mouse.x + 0.5 * ev.movementX < w / 2 && mouse.x + 0.5 * ev.movementX > -w / 2) ? 0.5 * ev.movementX : 0;
        mouse.y -= (mouse.y - 0.5 * ev.movementY < h / 2 && mouse.y - 0.5 * ev.movementY > -h / 2) ? 0.5 * ev.movementY : 0;    
    }else{
        mouse.x = ev.clientX - w/2;
        mouse.y = -ev.clientY + h/2;
    }
    pointer.x = (mouse.x / (w / 2));
    pointer.y = (mouse.y / (h / 2));
});


animate();
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
var shift;
//svi pritisnuti keyevi
var keys = {}

function onKeyDown(ev) {
    keyPress(ev, true);
}
function onKeyUp(ev) {
    keyPress(ev, false);
}
function keyPress(ev, pressed) {
    if (keys[ev.key] != pressed) {
        //console.log((pressed) ? "press" : "release");
        //console.log(ev);
        switch (ev.code) {
            case 'KeyW':
                move.forward = pressed;
                break;
            case 'KeyA':
                move.left = pressed;
                break;
            case 'KeyS':
                move.backward = pressed;
                break;
            case 'KeyD':
                move.right = pressed;
                break; 
            case 'KeyE':
                move.rotateRight = pressed;
                break; 
            case 'KeyQ':
                move.rotateLeft = pressed;
                break;
            case 'ShiftLeft':{speed=(pressed)?10:5; shift=pressed;};break;
            case 'Space':{move.up=pressed;};break;
            case 'KeyC':{move.down=pressed;};break;
            case 'KeyY':
            {
                if(pressed && undo.length>0){
                    
                    scene.remove(undo.pop());
                    
                }
            }; break;
            case 'KeyT':
            {
                if(pressed){
                    
                    var rc = new THREE.Raycaster();
                    rc.setFromCamera(pointer, camera);
                    
                    var b = rc.intersectObject(gridScene)[0]
                    if(b!=undefined){
                        console.log(b.object);
                    } 
                    
                }
            }; break;
            default:
                break;
        }
    }
    keys[ev.code] = pressed;
}

/*
setInterval(() => {
    sendStateChange();
}, 1000/60);*/


window.onresize = (ev) => {
    console.log("resize");
    console.log(ev);
    //camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    //camera.aspect =100;

    w = window.innerWidth;
    h = window.innerHeight;
    //camera.aspect=w/h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    cameraHud.aspect = w / h;
    cameraHud.updateProjectionMatrix();
    cameraHud.left = -w / 2;
    cameraHud.right = w / 2;
    cameraHud.top = h / 2;
    cameraHud.bottom = -h / 2;
    templateGroup.position.set(w/2-100,h/2-100,1)
    renderer.setSize(w, h);
}

document.getElementById("saveBtn").onclick = saveMap;
var statusText = document.getElementById("status");
document.getElementById("erase").onclick = ()=> switchMode("erase");
document.getElementById("place").onclick = ()=> switchMode("place");
document.getElementById("move").onclick = ()=> switchMode("move");
document.getElementById("edit").onclick = ()=> switchMode("edit");
document.getElementById("spawn").onclick = ()=> switchMode("spawn");
document.getElementById("goal").onclick = ()=> switchMode("goal");
document.getElementById("maptype").onchange = (ev)=> switchType(ev);
document.getElementById("foundation-popup-button").onclick = ()=> changePlane();
document.getElementById("navMeshBtn").onclick = generateNavMesh;
var isEditingFoundation = false;
function saveMap() {
    //console.log(saveScene);
    scene.remove(placePlane);
    document.getElementById("name").value
    generateNavMesh();
    //saveScene.add(plane);
    for(let o of addedObjects){
        o.userData.type="userGenerated";
        //saveScene.add(o);
    }
    fetch('/saveMap', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            id: (new URLSearchParams(window.location.search)).get("id"),
            name: document.getElementById("name").value,
            map: scene.toJSON(),
            type: document.getElementById("maptype").value,
            navmesh: navMesh.nodes.map(n=>n.toSendable()),
            mode:(new URLSearchParams(window.location.search)).get("type")
        }), 
    }).then(res => res.json())
    .then(val => {
        console.log(val)
        window.location.assign(`/createMap?type=edit&id=${val.mapId}&version=${val.mapVersion}`);
    })
    .catch(err => console.log(err));

}

function switchMode(newMode){
    console.log(newMode);
    document.getElementById(mode).hidden=false;
    document.getElementById(newMode).hidden=true;
    statusText.textContent="Mode: "+newMode
    if(newMode == "place"){
        buildingCube.material.opacity=0.5;
        mode = newMode
        shiftPlacing={
            state:0,
            positions:[],
            direction:null,
            startPosition:null,
            blocks:[],
            vertices:[],
            block:null
        };
    }else if(newMode == "erase") {
        mode = newMode
        buildingCube.material.opacity=0;
    } if(newMode == "move") {
        mode = newMode
        buildingCube.material.opacity=0;
    }else if(newMode == "goal") {
        mode = newMode
        buildingCube.material.opacity=0;
    }else if(newMode == "spawn"){
        mode = newMode
        buildingCube.material.opacity=0;
    }else if(newMode == "edit"){
        mode = newMode
        buildingCube.material.opacity=0;
    }
}
function changePlane(){
    console.log(isEditingFoundation);
    isEditingFoundation = !isEditingFoundation;
    document.getElementById("foundation-popup").hidden = !isEditingFoundation;
}
var mapType = document.getElementById("maptype").value;
console.log("MT "+mapType);
function switchType(ev){
    console.log(ev);
    mapType = ev.target.value
    goalHelper.visible= mapType == "campaign";
    if(mapType == "survival"){
        document.getElementById("goal").hidden = true;

    }
    else if (mapType == "campaign"){
        document.getElementById("goal").hidden = false;
    }
}
var lastLength=0;
function generateSpecialNodes(point, range, isSpawn, isGoal){
    if(isSpawn==undefined || isGoal == undefined)return;
    var navMeshRCs=[];
    for(var y=-0.9; y<1; y+=0.1){
        var r = new THREE.Raycaster(new THREE.Vector3(point.x, y, point.z), new THREE.Vector3(1,0,0));
        r.near=0;
        r.far=range;
        navMeshRCs.push(r);
    }
    //console.log(navMeshRCs);
    var minPoint={
        x1:null,
        x2:null,
        z1:null,
        z2:null,
    };
    var minDist={
        x1:null,
        x2:null,
        z1:null,
        z2:null,
    };
    //get x;
    for(var r of navMeshRCs){
        var first = r.intersectObject(scene)[0];
        //console.log(first);
        var dist = (first == undefined)?r.far:first.distance;
        if(minDist.x1 == null || minDist.x1>=dist){
            var pos = new THREE.Vector3();
            r.ray.at(dist, pos);
            minDist.x1=dist;
            minPoint.x1 = pos.x;
        }
        r.ray.direction.setX(-1);
        first = r.intersectObject(scene)[0];
        dist = (first == undefined)?r.far:first.distance;
        if(minDist.x2 == null || minDist.x2>=dist){
            var pos = new THREE.Vector3();
            r.ray.at(dist, pos);
            minDist.x2=dist;
            minPoint.x2 = pos.x;
        }
        r.ray.direction.setX(0);
    }
    //get y;
    if(minPoint.x1>minPoint.x2){
        var tmp = minPoint.x1;
        minPoint.x1=minPoint.x2
        minPoint.x2=tmp;
    }
    for (let x = minPoint.x1+0.1; x<minPoint.x2; x+=0.1) {
        for(var r of navMeshRCs){
            r.ray.origin.set(x, r.ray.origin.y, r.ray.origin.z);
            r.ray.direction.setZ(-1);
            var first = r.intersectObject(scene)[0]
            var dist = (first == undefined)?r.far:first.distance;
            if(minDist.z1 == null || minDist.z1>=dist){
                var pos = new THREE.Vector3();
                r.ray.at(dist, pos);
                minDist.z1= dist;
                minPoint.z1 = pos.z;
            }
            r.ray.direction.setZ(1);
            first = r.intersectObject(scene)[0]
            dist = (first == undefined)?r.far:first.distance;
            if(minDist.z2 == null || minDist.z2>=dist){
                var pos = new THREE.Vector3();
                r.ray.at(dist, pos);
                minDist.z2= dist;
                minPoint.z2 = pos.z;
            }
        }
    }
    if(minPoint.z1>minPoint.z2){
        var tmp = minPoint.z1;
        minPoint.z1=minPoint.z2
        minPoint.z2=tmp;
    }
    console.log(minPoint);
    // const box = new THREE.Box3();
    // box.setFromPoints([
    //     new THREE.Vector3(minPoint.x1, -1, minPoint.z1),
    //     new THREE.Vector3(minPoint.x1, 1, minPoint.z1),
    //     new THREE.Vector3(minPoint.x1, -1, minPoint.z2),
    //     new THREE.Vector3(minPoint.x1, 1, minPoint.z2),
    //     new THREE.Vector3(minPoint.x2, -1, minPoint.z1),
    //     new THREE.Vector3(minPoint.x2, 1, minPoint.z1),
    //     new THREE.Vector3(minPoint.x2, -1, minPoint.z2),
    //     new THREE.Vector3(minPoint.x2, 1, minPoint.z2),
    // ]);

    // const helper = new THREE.Box3Helper( box, 0xffff00 ^ isGoal*0xff0000 );
    // scene.add( helper );
    var specialNode = new Node(lastNodeId++, minPoint.x1, minPoint.x2, minPoint.z1, minPoint.z2, false, isSpawn, isGoal);
    
    navMesh.nodes.push(specialNode)
}
function generateSpecialNodesMath(point, range, isSpawn, isGoal){
    if(isSpawn==undefined || isGoal == undefined)return;
    var ray=new THREE.Ray(new THREE.Vector3(point.x,0,point.z), new THREE.Vector3(1,0,0));
    var nearestObjects = navMesh.nodes.filter(o=>o.obstacle)
    //console.log(navMeshRCs);
    var minPoint={
        x1:null,
        x2:null,
        z1:null,
        z2:null,
    };
    var minDist={
        x1:null,
        x2:null,
        z1:null,
        z2:null,
    };
    //get x;
    var firstDist = range;
    var first = undefined;
    for(let no of nearestObjects.filter(no=>ray.intersectsBox(no.box))){
         let p = new THREE.Vector3();   
         ray.intersectBox(no.box, p);
         let d = p.distanceTo(ray.origin);
         if(d<=firstDist){
            firstDist = d;
            first = no;
         }
    }
    //console.log(first);
    var dist = (first == undefined)?range:firstDist;
    if(minDist.x1 == null || minDist.x1>=dist){
        var pos = new THREE.Vector3();
        ray.at(dist, pos);
        minDist.x1=dist;
        minPoint.x1 = pos.x;
    }
    ray.direction.setX(-1);
    firstDist = range;
    first = undefined;
    for(let no of nearestObjects.filter(no=>ray.intersectsBox(no.box))){
         let p = new THREE.Vector3();   
         ray.intersectBox(no.box, p);
         let d = p.distanceTo(ray.origin);
         if(d<=firstDist){
            firstDist = d;
            first = no;
         }
    }
    dist = (first == undefined)?range:firstDist;
    if(minDist.x2 == null || minDist.x2>=dist){
        var pos = new THREE.Vector3();
        ray.at(dist, pos);
        minDist.x2=dist;
        minPoint.x2 = pos.x;
    }
    ray.direction.setX(0);
    if(minPoint.x1>minPoint.x2){
        var tmp = minPoint.x1;
        minPoint.x1=minPoint.x2
        minPoint.x2=tmp;
    }
    for (let x = minPoint.x1+0.1; x<minPoint.x2; x+=0.1) {

        ray.origin.set(x, ray.origin.y, ray.origin.z);
        ray.direction.setZ(-1);
        var firstDist = range;
        var first = undefined;
        for(let no of nearestObjects.filter(no=>ray.intersectsBox(no.box))){
            let p = new THREE.Vector3();   
            ray.intersectBox(no.box, p);
            let d = p.distanceTo(ray.origin);
            if(d<=firstDist){
                firstDist = d;
                first = no;
            }
        }
        var dist = (first == undefined)?range:firstDist;
        if(minDist.z1 == null || minDist.z1>=dist){
            var pos = new THREE.Vector3();
            ray.at(dist, pos);
            minDist.z1= dist;
            minPoint.z1 = pos.z;
        }
        ray.direction.setZ(1);
        firstDist = range;
        first = undefined;
        for(let no of nearestObjects.filter(no=>ray.intersectsBox(no.box))){
            let p = new THREE.Vector3();   
            ray.intersectBox(no.box, p);
            let d = p.distanceTo(ray.origin);
            if(d<=firstDist){
                firstDist = d;
                first = no;
            }
        }
        dist = (first == undefined)?range:first.distance;
        if(minDist.z2 == null || minDist.z2>=dist){
            var pos = new THREE.Vector3();
            ray.at(dist, pos);
            minDist.z2= dist;
            minPoint.z2 = pos.z;
        }
        
    }
    if(minPoint.z1>minPoint.z2){
        var tmp = minPoint.z1;
        minPoint.z1=minPoint.z2
        minPoint.z2=tmp;
    }
    console.log(minPoint);
    // const box = new THREE.Box3();
    // box.setFromPoints([
    //     new THREE.Vector3(minPoint.x1, -1, minPoint.z1),
    //     new THREE.Vector3(minPoint.x1, 1, minPoint.z1),
    //     new THREE.Vector3(minPoint.x1, -1, minPoint.z2),
    //     new THREE.Vector3(minPoint.x1, 1, minPoint.z2),
    //     new THREE.Vector3(minPoint.x2, -1, minPoint.z1),
    //     new THREE.Vector3(minPoint.x2, 1, minPoint.z1),
    //     new THREE.Vector3(minPoint.x2, -1, minPoint.z2),
    //     new THREE.Vector3(minPoint.x2, 1, minPoint.z2),
    // ]);

    // const helper = new THREE.Box3Helper( box, 0xffff00 ^ isGoal*0xff0000 );
    // scene.add( helper );
    var specialNode = new Node(lastNodeId++, minPoint.x1, minPoint.x2, minPoint.z1, minPoint.z2, false, isSpawn, isGoal);
    
    navMesh.nodes.push(specialNode)
}
function generateNavMesh(){
    gridScene.children.filter(c=>c.name=="neighbourLine").forEach(c=>c.removeFromParent());
    navMesh.nodes.filter(n=>!n.obstacle).forEach(o=> o.removeFromScene());
    navMesh.nodes = navMesh.nodes.filter(n=>n.obstacle);
    nodeArea=0;
    var goalLine = scene.children.find(c=>c.name=="goalLine");
    if(goalLine) scene.remove(goalLine);
    generateSpecialNodesMath(spawnPoint.point, 3.5, true, false)
    if(mapType=="campaign")
        generateSpecialNodesMath(goal.point, 3.5, false, true) //for goal
    console.log("generating");
    generateNavMeshRecursiveMath(navMesh.nodes.find(n=> n.spawnNode));
    console.log("generated all");

    for(let n of navMesh.nodes){
        if(n.neighbours.size==0 && !n.obstacle){
            console.log("NON");
            console.log(n);
            const nodebox = new THREE.Box3();
            nodebox.setFromPoints([
                new THREE.Vector3(n.x1, -1, n.z1),
                new THREE.Vector3(n.x1, 1, n.z1),
                new THREE.Vector3(n.x1, -1, n.z2),
                new THREE.Vector3(n.x1, 1, n.z2),
                new THREE.Vector3(n.x2, -1, n.z1),
                new THREE.Vector3(n.x2, 1, n.z1),
                new THREE.Vector3(n.x2, -1, n.z2),
                new THREE.Vector3(n.x2, 1, n.z2),
            ]);
            
            const helper = new THREE.Box3Helper( nodebox, 0xFF00ff );
            gridScene.add(helper)
        }

        for(let n2 of n.neighbours.entries()){
            let neighbour =  navMesh.nodes.find(x=> x.id == n2[0]);
            if(neighbour!=undefined){
                
                const material = new THREE.LineBasicMaterial({
                    color: 0x00ff00//new THREE.Color().setRGB(Math.random(),Math.random(),Math.random())
                });
                /*  
                        1
                    z2*******
                    *       *
                   2*       *3
                    *       *
                    z1*******
                    x1   0   x2
                */
                const points = [];
                var bx1=(n.x1>neighbour.x1)?n.x1:neighbour.x1;
                var bx2=(n.x2<neighbour.x2)?n.x2:neighbour.x2;
                var bz1=(n.z1>neighbour.z1)?n.z1:neighbour.z1;
                var bz2=(n.z2<neighbour.z2)?n.z2:neighbour.z2;
                points.push( new THREE.Vector3( n.center.x, 0, n.center.z ) );

                if(n2[1] == 0)
                points.push( new THREE.Vector3( (bx1+bx2)/2, 0, n.z1 ) );
                if(n2[1] == 1)
                points.push( new THREE.Vector3( (bx1+bx2)/2, 0, n.z2 ) );
                if(n2[1] == 2)
                points.push( new THREE.Vector3( n.x1, 0, (bz1+bz2)/2 ) );
                if(n2[1] == 3)
                points.push( new THREE.Vector3( n.x2, 0, (bz1+bz2)/2 ) );

                points.push( new THREE.Vector3( neighbour.center.x, 0,  neighbour.center.z ) );
                //console.log(points);
                const geometry = new THREE.BufferGeometry().setFromPoints( points );
                
                const line = new THREE.Line( geometry, material );
                line.name="neighbourLine";
                gridScene.add( line );
            }
        }
    }
}
//4 ruba
// 1->2
// 2->3
// 3->4
// 4->1

/*
   0 x1->x2 z1 -1z
   1 x1->x2 z2 +1z
   2 z1->z2 x1 -1x
   3 z1->z2 x2 +1x
*/

function generateNavMeshRecursiveMath(node, debug = false){//parent node
    //console.log("generating for");
    //console.log(node);
    var ray=new THREE.Ray(new THREE.Vector3(0,0,0), new THREE.Vector3(1,0,0));
    var nearestObjects = navMesh.nodes.filter(o=>o.box.distanceToPoint(new THREE.Vector3(node.center.x, 0, node.center.z))<=45)

    /*  
           1
      z2*******
        *     *
      2 *     *3
        *     *
      z1*******
      x1   0   x2
    */
    var newNodes=[];
    for(var side = 0; side < 4; side++){
        if(debug)console.log("side "+side );
        var a1, a2;
        let box = {
            isGenerating:false,
            x1:null,
            x2:null,
            z1:null,
            z2:null,
        };

        if(side==0) {ray.direction.set(0,0,-1); a1=node.x1; a2=node.x2} 
        if(side==1) {ray.direction.set(0,0,1);  a1=node.x1; a2=node.x2}
        if(side==2) {ray.direction.set(-1,0,0); a1=node.z1; a2=node.z2} 
        if(side==3) {ray.direction.set(1,0,0);  a1=node.z1; a2=node.z2} 
        const mult = 100;
        a1=Math.round(a1*mult);
        a2=Math.round(a2*mult); // 1 -> 1000 2 -> 2000 2050
        let a = a1
        let minDist = 100;
        let minDistPoint = new THREE.Vector3();
        let startPoint, endPoint;
        for(var t = 0; t<1; t++){

       
        for (a = (t==0)?a1:a2; (t==0)?a<=a2:a>=a1; a+=(t==0)?1:-1) {//scan line
            
            if(side==0) ray.origin.set( a/mult, ray.origin.y, node.z1+0.05); 
            if(side==1) ray.origin.set( a/mult, ray.origin.y, node.z2-0.05); 
            if(side==2) ray.origin.set( node.x1+0.05, ray.origin.y, a/mult); 
            if(side==3) ray.origin.set( node.x2-0.05, ray.origin.y, a/mult);      
         

            var nearestObject=undefined;
            var noDist = 8;
            
            for(let no of nearestObjects.filter(no=>ray.intersectsBox(no.box) && no.id!=node.id)){

                let p = new THREE.Vector3();
                
                ray.intersectBox(no.box, p);
                let rayOrigin = new THREE.Vector3();
                if(side==0) rayOrigin.set( a/mult, ray.origin.y, node.z1); 
                if(side==1) rayOrigin.set( a/mult, ray.origin.y, node.z2); 
                if(side==2) rayOrigin.set( node.x1, ray.origin.y, a/mult); 
                if(side==3) rayOrigin.set( node.x2, ray.origin.y, a/mult);   
                let d = p.distanceTo(rayOrigin);
               
                if(d<=noDist){
                   
                    noDist = d;
                    nearestObject = no;
                }
               
            }
            
            if(noDist>0.205){
                if(!box.isGenerating){
                    if(debug)console.log("starting to generate");
                    if(debug)console.log("from "+a+" "+a1+"-"+a2);
                    box.isGenerating=true;
                    startPoint=a/mult;
                }
                if(minDist>noDist){
                    minDist = noDist;
                    ray.at(minDist, minDistPoint);

                }
                endPoint=a/mult;
            }
            
            if(noDist<=0.2 || a>=a2){
                if(debug)console.log("end or block");
                if(debug)console.log("nd "+noDist);
                if(box.isGenerating){
                    if(debug)console.log("ending to generate");
                    if(debug)console.log("to "+a+" "+a1+"-"+a2);
                    if(side==0) {
                        box.x1=startPoint;
                        box.x2=endPoint;
                        box.z1=minDistPoint.z;
                        box.z2=node.z1;
                    }
                    if(side==1) {
                        box.x1=startPoint;
                        box.x2=endPoint;
                        box.z1=node.z2;
                        box.z2=minDistPoint.z;
                    }
                    if(side==2) {
                        box.x1=minDistPoint.x;
                        box.x2=node.x1;
                        box.z1=startPoint;
                        box.z2=endPoint;
                    }
                    if(side==3) {
                        box.x1=node.x2;
                        box.x2=minDistPoint.x;
                        box.z1=startPoint;
                        box.z2=endPoint;
                    }  
                    if(debug)console.log("box");
                    if(debug)console.log(box.x1, box.x2, box.z1, box.z2);
                    if((box.x2-box.x1) > 0.5 && (box.z2-box.z1) > 0.5){
                        
                        box.x1=Math.trunc(box.x1*10)/10;
                        box.x2=Math.trunc(box.x2*10)/10;
                        box.z1=Math.trunc(box.z1*10)/10;
                        box.z2=Math.trunc(box.z2*10)/10;

                        const nodebox = new THREE.Box3();
                            
                        nodebox.setFromPoints([
                            new THREE.Vector3(box.x1, -1, box.z1),
                            new THREE.Vector3(box.x1, 1, box.z1),
                            new THREE.Vector3(box.x1, -1, box.z2),
                            new THREE.Vector3(box.x1, 1, box.z2),
                            new THREE.Vector3(box.x2, -1, box.z1),
                            new THREE.Vector3(box.x2, 1, box.z1),
                            new THREE.Vector3(box.x2, -1, box.z2),
                            new THREE.Vector3(box.x2, 1, box.z2),
                        ]);
                        const helper = new THREE.Box3Helper( nodebox, new THREE.Color().setRGB(Math.random(),Math.random(),Math.random()) );
                        var newNode = new Node(lastNodeId, box.x1, box.x2, box.z1, box.z2, false, false, false);
                        if(debug)console.log(newNode);
                        node.neighbours.set(lastNodeId,side);
                        lastNodeId++;
                        var opSide;
                        if(side == 0) opSide = 1;
                        if(side == 1) opSide = 0;
                        if(side == 2) opSide = 3;
                        if(side == 3) opSide = 2;
                        newNode.neighbours.set(node.id,opSide);
                        navMesh.nodes.push(newNode)
                        newNodes.push(newNode);
                        if(!debug)console.log("Generating "+((nodeArea/area)*100)+"%");
                        if(debug)console.log(box.x1, box.x2, box.z1, box.z2);
                          
                    }

                    box = {
                        isGenerating:false,
                        x1:null,
                        x2:null,
                        z1:null,
                        z2:null,
                    };
                    minDist=100;
                }else{
                    if(nearestObject != undefined && nearestObject.obstacle==false && a>a1+20 && a<a2-20){//nasao neki node navmesha
                        node.neighbours.set(nearestObject.id, side);
                        var opSide;
                        if(side == 0) opSide = 1;
                        if(side == 1) opSide = 0;
                        if(side == 2) opSide = 3;
                        if(side == 3) opSide = 2;
                        nearestObject.neighbours.set(node.id, opSide);
                    }
                }
            }

        }
        }
    }
    for(var n of newNodes){       
        generateNavMeshRecursiveMath(n); 
    }
}