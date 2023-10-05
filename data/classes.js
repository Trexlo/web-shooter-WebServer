
class Player {
  id;
  username;
  nickname;
  image;
  guest;
  color;
  reconnected = 0;
  constructor(id, username, nickname, image, color="#"+Math.floor(Math.random()*256).toString(16)+Math.floor(Math.random()*256).toString(16)+Math.floor(Math.random()*256).toString(16), guest = false){
    this.id = id; 
    this.username = username; 
    this.nickname = nickname; 
    this.image = image;
    this.color = color;
    this.guest = guest; 
  }
}

class IngamePlayer{
  id; 
  nickname;
  position;
  rotation;
  model;
  color;
  label;
}

class GameMap{
  constructor(id, version, data, name, type){
    this.id = id; 
    this.version = version;
    this.data = data;
    this.name = name;
    this.type = type;
  }
  id; 
  version;
  data;
  name;
  type;
}
class GameSave{
  constructor(id, mapId, mapVersion, data, savedOn){
    this.id = id;
    this.mapId = mapId;
    this.mapVersion = mapVersion;
    this.data = data;
    this.savedOn = new Date(savedOn);
    this.players = [];
  }
  id;
  mapId;
  mapVersion;
  data;
  savedOn;
  players;
}
class Lobby {
  id;
  name;
  host;
  players = new Map();
  gameServer;
  mapId;
  mapVersion;
  started = false;
  isPrivate = false;
  //--gamesave only--
  isGameSave = false;
  saveData;
  playerOrder = {};
  isFull = false;
  //--gamesave only--
  password = "";
  constructor(id, name, host, gameServer, mapId, mapVersion, isPrivate, password, isGameSave, saveData) {
    this.id = id;
    this.name = name;
    this.host = host;
    this.gameServer = gameServer;
    this.mapId = mapId;
    this.mapVersion = mapVersion;
    this.isPrivate = isPrivate;
    this.password = password;
    this.isGameSave = isGameSave;
    this.saveData = saveData;
    if(saveData!=null && saveData!=undefined){
      for(var p of saveData.players){
        this.playerOrder[p.number]={oldId:p.id, newId:null};
      }
    }
    //this.startCheck();
  };
  // setPassword(password){
  //   this.password = password;
  //   this.private = true;
  // }
  // async startCheck() {
  //   setTimeout(() => {
  //     ioServer.timeout(2000).to(this.id).emitWithAck("connectivityCheck").then(val => {
  //       console.log(val);
  //       this.startCheck();
  //     }).catch(err => {
  //       console.log(err);
  //     })
  //   }, 2000);

  // };
  toSendable(){
    return {
      id: this.id,
      name: this.name,
      host: this.host,
      mapId: this.mapId,
      started: this.started,
      hasPassword: this.password!='',
      players: Array.from(this.players.values()),
    }
  };

}

class GameServer{
  constructor(ip, port, client, server, secure) {
    this.ip = ip;
    this.port = port;
    this.client = client;
    this.server = server;
    this.secure = secure
  }
  ip;
  port;
  client;
  server;
  secure;
}

module.exports = {Player, Lobby, GameServer, IngamePlayer, GameMap, GameSave}