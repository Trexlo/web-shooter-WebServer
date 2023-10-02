const express = require('express')
const app = express()
const port = 3000
const path = require('path');
const { Server } = require("socket.io");
const { io } = require('socket.io-client');

const nocache = require('nocache');
const expressSession = require('express-session');
const pgSession = require('connect-pg-simple')(expressSession);
const { randomUUID } = require('crypto');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");

const cors = require('cors');

var ip = (process.env.IP)?process.env.IP:"127.0.0.1";
var gameServers = new Map();
var http = require('http');
const { writeFile, appendFile, readFile, readFileSync, writeFileSync, readdirSync } = require('fs');
const { pgPool, editUsername, signup, login, getUserById, editImage, editNickname, getMaps, saveNewMap, loadMap, getPlayerByUUID, editColor, getMapsFromPlayer, saveExistingMap, saveGame, getSavesFromPlayer, loadGame, editEmail, editPassword, getPasswordForUser, comparePassword, getUserEmail } = require('./data/dao');
const { Player, Lobby, GameServer } = require('./data/classes');

// try {
//   http.get({ 'host': 'api.ipify.org', 'port': 80, 'path': '/' }, function (resp) {
//     try {
//       resp.on('data', function (eip) {
//         console.log("My public IP address is: " + eip);
//         ip = eip;
//       });
//     } catch (error) {
//       console.log(error);
//     }

//   });
// } catch (error) {
//   console.log(error);
// }

var maplist = null;
var serverList = new Map();
const parseCookie = str =>
  str
    .split(';')
    .map(v => v.split('='))
    .reduce((acc, v) => {
      acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
      return acc;
    }, {});

var lobbies = new Map();
app.use(cors());
app.use(nocache());
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ limit: '25mb', extended: true, parameterLimit: 100 }))
app.use(cookieParser());

app.use(expressSession({
  store: new pgSession({
    pool: pgPool,                // Connection pool
    tableName: 'user_sessions',   // Use another table-name than the default "session" one,
    createTableIfMissing: true
  }),
  secret: 'DkmwFUPBeMeuFvlTtrqa',
  cookie: { maxAge: 1000 * 60 * 60 * 48 },
  rolling: true
}
))

function getLobbies(){
  var tmp = [];
  for (var l of lobbies.values()) {
    if(!l.started && !l.isPrivate && !l.isFull)
      tmp.push(l.toSendable());
  }
  return tmp;
}

app.use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')

app.get('/login', (req, res) => {
  res.render('login');
})

app.get('*', (req, res, next) => {
  console.log("----GET REQUEST----");
  console.log(req.url);
  console.log(req);

  console.log(res);
  console.log("----GET REQUEST----");
  if (req.session.user){
    next();
  }
  else {
    res.redirect('/login?from='+req.url);
  }
})
app.post('/login', async (req, res) => {
  console.log("----POST REQUEST----");
  console.log(req.url);
  // console.log(req);
  // console.log(res);
  console.log("----POST REQUEST----");
  try{
    req.session.user = await login(req.body.username, req.body.password);
    res.cookie("id", req.session.user.id);
    res.json({error:false, message:""})
  }catch(err){
    console.log(err);
    res.json({error:true, message:"Wrong username or password"});
  }
});
app.post('/signup', async (req, res) => {
  if(req.body.username==""){
    res.json({error:true, message:"Account name cannot be empty"});
    return;
  }
  if(req.body.email==""){
    res.json({error:true, message:"Email cannot be empty"});
    return;
  }
  if(!req.body.email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g)){
    res.json({error:true, message:"Invalid email"});
    return;
  }
  if(req.body.password==""){
    res.json({error:true, message:"Password cannot be empty"});
    return;
  }
  if(req.body.repeatPassword!=req.body.password){
    res.json({error:true, message:"Passwords do not match"});
    return;
  }
  res.json(await signup(req.body.username, req.body.email, req.body.password));
});
app.post('/guest', (req, res) => {
  console.log("----POST REQUEST----");
  console.log(req.url);
  console.log(req);
  console.log(res);
  console.log("----POST REQUEST----");
  if(req.session.user == undefined){
    req.session.user = new Player();
    req.session.user.guest = true;
    req.session.user.id = randomUUID();
    req.session.user.image = "guest_gray.png";
    res.cookie("id", req.session.user.id);
  }
  var name = "Guest"
  if(req.body.username != undefined && req.body.username!="") name = req.body.username;
  req.session.user.nickname = name;
  res.json({error:false, message:""})
});

app.post('/changeAccountInfo', async (req,res)=>{
  if(req.body.username){
    if(req.body.username==""){
      res.json({error:true, message:"Account name cannot be empty"})
      return;
    }
    try{
      await editUsername(req.session.user.id, req.body.username);
    }catch (err){
      res.json({error:true, message:err.message})
      return;
    }
  }

  if(req.body.email){
    if(await comparePassword(req.session.user.id, req.body.currentPassword)){
      if(req.body.email==""){
        res.json({error:true, message:"Email cannot be empty"})
        return;
      }
      if(!req.body.email.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g)){
        res.json({error:true, message:"Invalid email"});
        return;
      }
      try{
        await editEmail(req.session.user.id, req.body.email);
      }catch (err){
        res.json({error:true, message:err.message})
        return;
      }
    }else {
      res.json({error:true, message:"Provided wrong password"})
      return;
    }
  }
  if(req.body.newPassword){
    if(await comparePassword(req.session.user.id, req.body.currentPassword)){
      if(req.body.newPassword==""){
        res.json({error:true, message:"Password cannot be empty"})
        return;
      }
      await editPassword(req.session.user.id, req.body.newPassword);
    }else {
      res.json({error:true, message:"Provided wrong password"})
      return;
    }
  }
  if(req.body.color){
    await editColor(req.session.user.id, req.body.color);
  }
  if(req.body.image){
    const buffer = Buffer.from(req.body.image.substring(req.body.image.indexOf(',')+1), "base64");
    await writeFileSync("./public/images/userImages/"+req.session.user.id+".png", buffer);
    await editImage(req.session.user.id, req.session.user.id+".png");
  }
  console.log(req.session.user);
  req.session.user = await getPlayerByUUID(req.session.user.id);
  res.json({error:false, message:""});
});

app.post('*', (req, res, next) => {
  console.log("----POST REQUEST----");
  console.log(req.url);
  console.log(req);
  console.log(res);
  console.log("----POST REQUEST----");
  if (req.session.user)
    next();
  else {
    res.redirect('/login?from='+req.url);
  }
})

app.post('/redirect', (req, res, next) => {
  res.redirect((req.body.from=='' || req.body.from=='/redirect')?'/':req.body.from);
});

app.get('/', async (req, res) => {
  if(maplist == null) maplist = await getMaps();
  var saves=[];
  if(!req.session.user.guest) saves =  await getSavesFromPlayer(req.session.user.id);
  console.log(saves);
  res.render('main', { lobbies: getLobbies(), saves:saves, ip: (req.socket.localAddress == req.socket.remoteAddress) ? "localhost" : ip, maps: maplist, player: req.session.user });
})
app.get('/account', async (req, res) => {
  res.render('account', {player: req.session.user, playerEmail:await getUserEmail(req.session.user.id), maps: await getMapsFromPlayer(req.session.user.id, false)});
})

app.post('/createLobby', async (req, res) => {
  var id = randomUUID();
  var mapIdAndVersion = [req.body.map.substring(0,req.body.map.indexOf(',')), req.body.map.substring(req.body.map.indexOf(',')+1)];
  var name = "Unnamed lobby";
  if(req.body.name != undefined && req.body.name != "")name=req.body.name;
  if(maplist == null) maplist = await getMaps();
  var map =  maplist.find(m=>m.id == mapIdAndVersion[0]);
  lobbies.set(id, new Lobby(id, name + " - " + map.name + " - "+map.type, req.session.user.id, null/*await gameServers.values().next().value.server*/, mapIdAndVersion[0], mapIdAndVersion[1], req.body.private, req.body.password, false))
  if(req.body.password != '') lobbies.get(id).players.set(req.session.user.id, req.session.user);
  console.log(maplist);
  console.log(Array.from(lobbies.values()));
  res.redirect('lobby?id=' + id);
})
app.post('/getServers', (req, res) => {
  var lobby = lobbies.get(  req.body.lobbyId);
  if(lobby!=undefined){
    if(lobby.host == req.session.user.id)
      res.json({error:false, message:"OK", servers:Array.from(gameServers.entries()).map((s)=>  {return {id:s[0], ip:s[1].ip, port:s[1].port}})});
    else{    res.json({error:true, message:"You are not the host"});}
  }else
    res.json({error:true, message:"No lobby"});
})
app.post('/createLoadLobby', async (req, res) => {  
  var id = randomUUID();
  var save = await loadGame(req.session.user.id, req.body.saveId);
  var map =  maplist.find(m=>m.id == save.mapId);
  var name = "Load game from "+save.savedOn.toLocaleString()+ " - " + map.name + " - "+map.type;
  var gameData = save.data;
  console.log(save);
  if(req.body.name != undefined && req.body.name != "")name=req.body.name;
  lobbies.set(id, new Lobby(id, name, req.session.user.id, null, gameData.mapId, gameData.mapVersion, req.body.private, req.body.password, true, gameData))
  if(req.body.password != '') lobbies.get(id).players.set(req.session.user.id, req.session.user);
  console.log(maplist);
  console.log(Array.from(lobbies.values()));
  res.redirect('lobby?id=' + id);
})
app.get('/lobby', async (req, res) => {
  if(maplist == null) maplist = await getMaps();
  if (!lobbies.has(req.query.id)) {
    res.status(404);
    res.render('notFound', { data: "Lobby" });
  } else {
    var currLobby = await lobbies.get(req.query.id);
    if(currLobby.password!='' && !currLobby.players.has(req.session.user.id)){
        res.render('password');
    }else if(currLobby.started){
      if(currLobby.players.has(req.session.user.id)){
        res.redirect('game?id=' + req.query.id);
      }
      else res.render('error', {error: "Game already started"});
    }else if(currLobby.isFull){
      res.render('error', {error: "Lobby is full"});
    }else{
      currLobby.players.set(req.session.user.id, req.session.user);
      ioServer.to(req.query.id).emit("lobbyPlayersChange", {lobby:currLobby, players: Array.from(currLobby.players.values()) })
      res.render('lobby', { 
        player: req.session.user, 
        lobby: currLobby,
        players: Array.from(currLobby.players.values()),
        ip: (req.socket.localAddress == req.socket.remoteAddress) ? "localhost" : ip,
        map: maplist.find(x=> x.id == currLobby.mapId && x.version == currLobby.mapVersion )
      });
    }
  }
})
app.post('/password', (req,res)=>{
  var lobby = lobbies.get(req.body.lobbyId);
  if(lobby!=undefined){

    if(lobby.password == req.body.password){
      lobby.players.set(req.session.user.id, req.session.user);
      res.redirect('lobby?id=' + req.body.lobbyId)
    }else{
      res.render('error', {error: "Wrong password"});
    }
  }else res.render('error', {error: "Lobby does not exist"});
})
app.post('/startGame', async (req, res) => {
  if (!lobbies.has(req.body.id)) {
    res.json("404");
    return;
  }
  var lobby = lobbies.get(req.body.id);
  if (lobby.host != req.session.user.id) {
    res.json("Cannot start, not host");
    return;
  }
  if (lobbies.has(req.body.id)) lobbies.get(req.body.id).started = true;
  if(lobby==undefined)return;
  console.log(lobby);
  lobby.gameServer =  await gameServers.get(req.body.serverId);
  if(!lobby.isGameSave)
    await lobby.gameServer.server.emitWithAck("createLobby", { id: req.body.id, mapId: lobby.mapId, mapVersion:lobby.mapVersion, players: Array.from(lobby.players.values()) });
  else{
    var players = Array.from(lobby.players.values())
    console.log(req.body.positions);
    console.log(lobby);
    for(var p in lobby.playerOrder){
      console.log("_______");
      console.log(p);
      console.log(lobby.playerOrder[p]);
      console.log(lobby.saveData.players.find(x=>x.number == p));
      if(lobby.playerOrder[p].newId != null && lobby.playerOrder[p].newId != ''){  
        var player =lobby.saveData.players.find(x=>x.number == p);
        player.id = lobby.playerOrder[p].newId;
        player.nickname = lobby.players.get(lobby.playerOrder[p].newId).nickname;
        player.color = lobby.players.get(lobby.playerOrder[p].newId).color;
        player.image = lobby.players.get(lobby.playerOrder[p].newId).image;
      }
        else{
        lobby.saveData.players.find(x=>x.number == p).id = p;
        lobby.saveData.players.find(x=>x.number == p).nickname = "didNotJoin";
        lobby.saveData.players.find(x=>x.number == p).ready = true;
      }
      console.log(lobby.saveData.players.find(x=>x.number == p));
      console.log("-------");
    }
    await lobby.gameServer.server.emitWithAck("createLoadLobby", { id: req.body.id, mapId: lobby.mapId, mapVersion:lobby.mapVersion, players: Array.from(lobby.players.values()), loadData: lobby.saveData  });
  }

  console.log("created");

  console.log("redirect to " + 'game?id=' + req.body.id);
  console.log("starting with "+Array.from(lobbies.get(req.body.id).players.keys()));
                                                                                //????
  ioServer.to(req.body.id).emit("gameStarted", { url: 'game?id=' + req.body.id, playerIds: Array.from(lobbies.get(req.body.id).players.keys()) });
  ioServer.emit("lobbiesUpdate", {
    lobbies: getLobbies()
  });
  res.json("200");
})
app.post('/joinGame', (req, res) => {
  res.redirect('game?id=' + req.body.id);
})

app.get('/game', async (req, res) => {
  if (!lobbies.has(req.query.id)) {
    res.status(404);
    res.render('notFound', { data: "Game" });
  } else {
    var lobby=lobbies.get(req.query.id);
    console.log(lobby);
    console.log(lobby.gameServer);
    if(lobby.players.has(req.session.user.id))
      res.render('game', {lobby: lobby, player:req.session.user, isHost: lobby.host == req.session.user.id, ip: lobby.gameServer.ip, port: lobby.gameServer.port});
    else res.render('error', {error:"You are not in this game"});
  }
})

app.get('/createMap', async (req, res) => {
  if(req.session.user.guest) res.redirect('/login?show=login');
  else{
    if(req.query.type=="createNew" || (req.query.type=="edit" && req.query.id != undefined)) {
      var textures = [];
      readdirSync('./public/images/textures').forEach(i=>{
        if(i.endsWith(".png")) textures.push(i);
      })
      res.render('editor', {textures: textures});
    }else res.redirect('createMap?type=createNew');
  }
})
app.post('/createMap', async (req, res) => {
  if(req.session.user.guest) res.redirect('/login?show=login');
  else{
    try {
      var map = await loadMap(req.session.user.id, req.body.mapId, req.body.version, true);
      console.log(map);
      res.send({error:false, map:map});
    } catch (error) {
      console.log(error);
      res.send({error:true, error:error});
    }
  }
})
app.get('/lobbyList', (req, res) => {
  res.send(lobbies);
})
app.get('/signout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
})

app.post('/saveMap', async (req, res) => {
  if(req.body.mode == "createNew")
    res.json(await saveNewMap(req.session.user, req.body.name, req.body.type, JSON.stringify({map:req.body.map, navmesh:req.body.navmesh})));
  
  if(req.body.mode == "edit")
    res.json(await saveExistingMap(req.session.user, req.body.id, req.body.name, req.body.type, JSON.stringify({map:req.body.map, navmesh:req.body.navmesh})));
  
  maplist = await getMaps();
})

app.post('/saveGame', async (req,res)=>{
  if(req.body.gameId){
    if(lobbies.has(req.body.gameId)){
      var lobby = lobbies.get(req.body.gameId);
      if(lobby.host == req.session.user.id){
        lobby.gameServer.server.emit("saveGame", {gameId: lobby.id}, (data)=>{
          if(data.error){
            console.log("ERR:"+data.message);
          }else{
            saveGame(req.session.user.id, lobby.mapId, lobby.mapVersion, data.data);
            res.json("Game Saved");
          }
        })
      }else{
        res.json("You are not the host");
      }
    }else{
      res.json("Lobby not found");
    }
  }
});

app.post('/getUserInfo', async (req,res)=>{
  if(req.body.uuid){
    var p = getUserById(req.body.uuid);
    res.json(p);
  }
  res.json("400")
});



app.post('/changeNickname', async (req,res)=>{
  if(req.body.nickname){
    if(!req.session.user.guest)
      await editNickname(req.session.user.id, req.body.nickname);
    req.session.user.nickname = req.body.nickname;
    console.log(req.session.user);
  }
  res.json("OK");
});




app.get('*', (req, res, next) => {
  res.status(404);
  res.render('notFound', { data: "Page" });
});




var server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})


const ioServer = new Server(server, {
  cors: true,
  origins: ["*"]
});

const sessionMiddleware = expressSession({
  secret: "keyboard cat",
  resave: false,
  saveUninitialized: false
});

ioServer.engine.use(sessionMiddleware);

ioServer.on('connection', (socket) => {
  console.log('a user connected');
  console.log(socket.handshake.address);
  console.log(socket);
  
  if(socket.handshake.query.type && socket.handshake.query.type == 'server'){
    var gameServerIp = socket.handshake.address.substring(socket.handshake.address.lastIndexOf(':')+1);
    var gameServerPort = "5000";
    if(gameServerIp == '127.0.0.1') gameServerIp = ip;
    if(socket.handshake.query.port != undefined) gameServerPort = socket.handshake.query.port;
    if(socket.handshake.query.overrideAddress == 'true'  && socket.handshake.query.ip) gameServerIp = socket.handshake.query.ip;
    gameServers.set(socket.id, new GameServer(gameServerIp.toString(), gameServerPort, socket, io("ws://"+gameServerIp+":"+gameServerPort)));
    console.log(gameServers);
  }
  
  socket.on("emptyLobby", (data) => {
    console.log("emptyLobby");
    console.log(data);
    lobbies.delete(data.id);
    ioServer.emit("lobbiesUpdate", { lobbies: getLobbies() });
  })
  socket.on("requestMap", async (data, ack) => {
    console.log("reqMap");
    console.log(data);

    var map = await loadMap(undefined, data.mapId, data.mapVersion, false);
    console.log("MAPA");
    console.log(map);
    ack({map});
  })
  socket.on("movePlayer", (data)=>{
    console.log(data);
    var lobby = lobbies.get(socket.handshake.query.gameId);
    var maxNum = Object.keys(lobby.playerOrder).length;
    console.log(maxNum);
    if(data.direction=="up"){
      var aPos = data.position
      var bPos=  (data.position-1 == -1)?maxNum-1:data.position-1;
      var tmpVal = lobby.playerOrder[aPos].newId;
      lobby.playerOrder[aPos].newId = lobby.playerOrder[bPos].newId;
      lobby.playerOrder[bPos].newId = tmpVal;
    }
    if(data.direction=="down"){
      var aPos = data.position
      var bPos=  (data.position+1 == maxNum)?0:data.position+1;
      var tmpVal = lobby.playerOrder[aPos].newId;
      lobby.playerOrder[aPos].newId = lobby.playerOrder[bPos].newId;
      lobby.playerOrder[bPos].newId = tmpVal;
    }
    ioServer.to(socket.handshake.query.gameId).emit("lobbyPlayersChange", {lobby: lobby, players: Array.from(lobby.players.values()), host: lobby.host })
  })
  socket.on("joinedLobby", (data) => {
    console.log("joined");
    console.log(data);
    socket.join(data.id);

    console.log(socket.rooms);
    if(lobbies.has(socket.handshake.query.gameId)){
      var lobby = lobbies.get(socket.handshake.query.gameId);
      if(lobby.players.has(socket.handshake.query.playerId)){
        var player = lobby.players.get(socket.handshake.query.playerId);
        player.reconnected++;
        console.log("Player "+player.nickname+"|"+player.id+" reconnected with value " + player.reconnected);
        if(lobby.isGameSave){
          var alreadySet=false;
          for(var o in lobby.playerOrder){
            if(lobby.playerOrder[o].oldId == player.id && lobby.playerOrder[o].newId == null){
              lobby.playerOrder[o].newId = player.id;
              alreadySet=true;
              break;
            }
          }
          if(!alreadySet){  
            for(var o in lobby.playerOrder){
              if(lobby.playerOrder[o].newId == null){
                lobby.playerOrder[o].newId = player.id;
                break;
              }
            }
          }
          lobby.isFull = lobby.players.size >= Object.keys(lobby.playerOrder).length;  
        }
      }else{

      }
      ioServer.to(socket.handshake.query.gameId).emit("lobbyPlayersChange", {lobby: lobby, players: Array.from(lobby.players.values()), host: lobby.host })
    }
   
    ioServer.emit("lobbiesUpdate", {
      lobbies: getLobbies()
    });
    
  });
  socket.on("disconnecting", (reason) => {
    console.log("disconnecting");
    console.log(reason);
    console.log(socket);

    if(socket.handshake.query.type && socket.handshake.query.type == 'server'){
      gameServers.delete(socket.id)
    }

    if(socket.handshake.query.at && socket.handshake.query.at=='lobby'){
      console.log("disconnection from lobby");
      console.log(socket.handshake.query);
      if(lobbies.has(socket.handshake.query.gameId)){
        var lobby = lobbies.get(socket.handshake.query.gameId);
        if(lobby.players.has(socket.handshake.query.playerId)){
          var player = lobby.players.get(socket.handshake.query.playerId);
          player.reconnected--;
          if(player.reconnected<=0 && !lobby.started){
            console.log("Player "+player.nickname+"|"+player.id+" disconnected with value " + player.reconnected);
            lobby.players.delete(socket.handshake.query.playerId);
            if(lobby.isGameSave){
              for(var o in lobby.playerOrder){
                if(lobby.playerOrder[o].newId == player.id){
                  lobby.playerOrder[o].newId = null;
                  break;
                }
              }
              lobby.isFull = lobby.players.size >= Object.keys(lobby.playerOrder).length;  
            }
            if(lobby.players.size>0 && lobby.host == socket.handshake.query.playerId && !lobby.isGameSave){
              lobby.host = Array.from(lobby.players.values())[0].id
            }
            setTimeout(() => {
              if(lobby.players.size == 0) lobbies.delete(socket.handshake.query.gameId); 
              ioServer.emit("lobbiesUpdate", {
                lobbies: getLobbies()
              });
            }, 1000);
            ioServer.emit("lobbiesUpdate", {
              lobbies: getLobbies()
            });
            ioServer.to(socket.handshake.query.gameId).emit("lobbyPlayersChange", {lobby:lobby, players: Array.from(lobby.players.values()), host: lobby.host })
          }
        }
      }
    }

  });
})
