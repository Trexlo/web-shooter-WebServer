const pg = require('pg');
const { Player, GameMap, GameSave } = require('./classes');

const pgPool = new pg.Pool({
    host: "localhost",
    user: "postgres",
    database: "diplrad",
    password: "123",
    port: 5432
  });

async function destroyDB(){
    pgPool.query(`
    DROP TABLE game_save;
    DROP TABLE map;
    DROP TABLE app_user;
    `)
}
async function init(){
    console.log("Initializing database");
    pgPool.query(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            CREATE EXTENSION IF NOT EXISTS pgcrypto;
            CREATE TABLE IF NOT EXISTS app_user (
                user_id SERIAL PRIMARY KEY,
                UUID uuid UNIQUE DEFAULT uuid_generate_v4 (),
                account_name VARCHAR UNIQUE NOT NULL,
                nickname VARCHAR NOT NULL,
                password TEXT NOT NULL,
                email VARCHAR NOT NULL UNIQUE,
                color VARCHAR DEFAULT '#cccccc',
                image VARCHAR DEFAULT 'guest_gray.png'
            );
            --CREATE TYPE map_type AS ENUM ('campaign', 'survival');
            CREATE TABLE IF NOT EXISTS map (
                map_id INTEGER,
                map_version INTEGER,
                map_data JSON NOT NULL,
                name VARCHAR NOT NULL,
                map_type map_type NOT NULL,
                creator_user_id INTEGER REFERENCES app_user(user_id),
                PRIMARY KEY (map_id, map_version)
            );
            CREATE TABLE IF NOT EXISTS game_save (
                save_id SERIAL PRIMARY KEY,
                game_data JSON NOT NULL,
                saved_on TIMESTAMP DEFAULT now(),
                host_user_id INTEGER NOT NULL REFERENCES app_user(user_id), 
                map_id INTEGER NOT NULL, 
                map_version INTEGER NOT NULL,
                FOREIGN KEY (map_id, map_version) REFERENCES map(map_id, map_version)
            ); 
    `)

}
async function login(username, password){
    // console.log(username);
    // console.log(password);
    var res = await pgPool.query('SELECT * FROM app_user WHERE account_name = $1 AND password = crypt($2, password)', [username, password]);
    console.log(res);
    if(res.rowCount>0) return new Player(res.rows[0].uuid, res.rows[0].account_name, res.rows[0].nickname, res.rows[0].image, res.rows[0].color, false);
    else throw new Error("Wrong username or password");
}
async function getPlayerByUUID(uuid){
    console.log(uuid);
    var res = await pgPool.query('SELECT * FROM app_user WHERE UUID = $1', [uuid]);
    console.log(res);
    if(res.rowCount>0) return new Player(res.rows[0].uuid, res.rows[0].account_name, res.rows[0].nickname, res.rows[0].image, res.rows[0].color, false)
    else throw new Error("No such user");
}
async function getUserByUUID(uuid){
    var res = await pgPool.query('SELECT * FROM app_user WHERE UUID = $1', [uuid]);
    console.log(res);
    if(res.rowCount>0) return res.rows[0];
    else throw new Error("No such user");
}
async function getUserEmail(uuid){
    var res = await getUserByUUID(uuid);
    return res.email;

}
async function getUserById(id){
    var res = await pgPool.query('SELECT * FROM app_user WHERE user_id = $1', [id]);
    console.log(res);
    if(res.rowCount>0) return res.rows[0];
    else throw new Error("No such user");
}
async function signup(username, email, password){
    var tryUsername = await pgPool.query('SELECT * FROM app_user WHERE account_name = $1', [username]);
    if(tryUsername.rowCount>0) return {error:true, message:"Account name already in use"};
    var tryMail = await pgPool.query('SELECT * FROM app_user WHERE email = $1', [email]);
    if(tryMail.rowCount>0) return {error:true, message:"Email already in use"};
    try{
        var res = await pgPool.query("INSERT into app_user(account_name, nickname, email, password) VALUES ($1, $2, $3, crypt($4, gen_salt('bf')) )", [username, username, email, password]);
    }catch(err){
        return {error:true, message:"An error ocurred"};
    }
    return {error:false, message:""};
}
async function editUsername(uuid, username){
    try{
        var res = await pgPool.query("UPDATE app_user SET account_name = $2 WHERE uuid = $1", [uuid, username]);
    }catch(err){
        throw new Error("Username already taken"); 
    }
}
async function editNickname(uuid, nickname){
    var res = await pgPool.query("UPDATE app_user SET nickname = $2 WHERE uuid = $1", [uuid, nickname]);
}
async function editEmail(uuid, email){
    try{
        var res = await pgPool.query("UPDATE app_user SET email = $2 WHERE uuid = $1", [uuid, email]);
    }catch(err){
        throw new Error("Email already taken"); 
    }
}
async function editPassword(uuid, password){
    var res = await pgPool.query("UPDATE app_user SET password = crypt($2, gen_salt('bf')) WHERE uuid = $1", [uuid, password]);
}
async function editImage(uuid, imageName){
    console.log(uuid);
    console.log(imageName);
    var res = await pgPool.query("UPDATE app_user SET image = $2 WHERE uuid = $1", [uuid, imageName]);
}
async function editColor(uuid, color){
    var res = await pgPool.query("UPDATE app_user SET color = $2 WHERE uuid = $1", [uuid, color]);
}

async function saveNewMap(player, name, type, data){
    var res = await pgPool.query( `INSERT into map(map_id, map_version, name, map_type, map_data, creator_user_id) VALUES 
    ((SELECT (coalesce(max(map_id), 0))+1 from map),
     1, 
     $1, 
     $2, 
     $3,
     (SELECT user_id FROM app_user WHERE UUID = $4)
      ) RETURNING map_id, map_version`, [name, type, data, player.id]);
    return {mapId: res.rows[0].map_id, mapVersion:res.rows[0].map_version};
}
async function saveExistingMap(player, mapId, name, type, data){
    var res = await pgPool.query( `INSERT into map(map_id, map_version, name, map_type, map_data, creator_user_id) VALUES 
    ($1,
    (SELECT (coalesce(max(map_version), 0))+1 from map where map_id = $1), 
     $2, 
     $3, 
     $4,
     (SELECT user_id FROM app_user WHERE UUID = $5)
      ) RETURNING map_id, map_version`, [mapId, name, type, data, player.id]);
    return {mapId: res.rows[0].map_id, mapVersion:res.rows[0].map_version};
}
async function getMaps(){
    var res = await pgPool.query( `SELECT map_id, max(map_version) as map_version, name, map_type FROM map group by map_id, name, map_type`);
    var maps = [];
    for (let r of res.rows){
        let m = new GameMap();
        m.id=r.map_id;
        m.version=r.map_version;
        m.name=r.name;
        m.type=r.map_type;
        maps.push(m);
    }
    return maps;
}
async function loadMap(playerId, mapId, version, editing=false){
    var res = await pgPool.query( `SELECT * FROM map WHERE map_id = $1 AND map_version = $2`, [mapId, version]);
    console.log(res);
    if(res.rowCount<=0) throw new Error("No such map");
    if(editing){
        var u = await getUserByUUID(playerId)
        if(u != undefined){
            if(u.user_id == res.rows[0].creator_user_id) return new GameMap(res.rows[0].map_id, res.rows[0].map_version, res.rows[0].map_data, res.rows[0].name, res.rows[0].map_type);
            else throw new Error("Map not in ownership of user");
        }else{
            throw new Error("User not found");//throws error
        }
    }else{
        return new GameMap(res.rows[0].map_id, res.rows[0].map_version, res.rows[0].map_data, res.rows[0].name, res.rows[0].map_type);
    }

}

async function getMapsFromPlayer(playerId, loadData=false){
    var res = await pgPool.query( `SELECT DISTINCT ON (map_id) map_id, map_version, ${(loadData)?"map_data,":""} name, map_type FROM map WHERE creator_user_id = (SELECT user_id FROM app_user WHERE UUID = $1) ORDER BY map_id, map_version DESC`, [playerId]);
    var maps = [];
    for (let r of res.rows){
        let m = new GameMap(r.map_id, r.map_version, r.map_data, r.name, r.map_type);
        maps.push(m);
    }
    return maps;
}
async function saveGame(playerId, mapId, version, data){
    var u = await getUserByUUID(playerId)
    if(u != undefined){
        var res = await pgPool.query( `INSERT into game_save(map_id, map_version, game_data, host_user_id) VALUES 
        ($1, $2, $3, $4)
        `, [mapId, version, data, u.user_id]);
    }else{
        throw new Error("User not found");//throws error
    }
}
async function loadGame(playerId, gameId){
    var u = await getUserByUUID(playerId)
    if(u != undefined){
        var res = await pgPool.query( `SELECT * from game_save WHERE save_id = $1`, [gameId]);
        console.log(res);
        if(res.rows[0] == undefined) throw new Error("Game not found");//throws error

        if(res.rows[0].host_user_id == u.user_id) return new GameSave(res.rows[0].save_id, res.rows[0].map_id, res.rows[0].map_version, res.rows[0].game_data, res.rows[0].saved_on);
        else throw new Error("User not owner of the save");//throws error
    }else{
        throw new Error("User not found");//throws error
    }
}
async function getSavesFromPlayer(playerId){
    var u = await getUserByUUID(playerId)
    if(u != undefined){
        var res = await pgPool.query( `SELECT * FROM game_save WHERE host_user_id = $1 ORDER BY saved_on DESC`, [u.user_id]);
        var saves = [];
        for (let r of res.rows){
            let s = new GameSave(r.save_id, r.map_id, r.map_version, null, r.saved_on);
            saves.push(s);
        }
        return saves;
    }else{
        throw new Error("User not found");//throws error
    }
}

async function comparePassword(playerUUID, password){
    var res = await pgPool.query('SELECT * FROM app_user WHERE uuid = $1 AND password = crypt($2, password)', [playerUUID, password]);
    if(res.rowCount>0) return true;
    else return false;
}
init()
module.exports = {pgPool,comparePassword,getUserEmail, saveGame,loadGame,getSavesFromPlayer, login, signup, editEmail, editImage, editColor, editPassword, editUsername, editNickname, getUserById, getPlayerByUUID, saveExistingMap, saveNewMap,loadMap, getMaps, getMapsFromPlayer}