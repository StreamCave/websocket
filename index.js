import { Server } from "socket.io";
import * as env from 'dotenv';
import * as mariadb from 'mariadb';
import moment from "moment";

env.config()

const io = new Server(55556, {
    cors: {
        origin: ["https://websocket.artaic.fr", "https://v4.dev.symfony.artaic.fr", "http://v4.dev.symfony.artaic.fr", "http://localhost:8081"],
    }
});

const pool = mariadb.createPool({
    host: process.env.DB_host,
    user: process.env.DB_user,
    password: process.env.DB_password,
    database: process.env.DB_database,
    connectTimeout: "-1"
})

io.on("connection", (socket) => {
    console.log("New connection");
    socket.on('disconnect', (data) => {
        if (data == "transport close") {
            pool.getConnection().then(async (conn) => {
                var userID = 0
                await conn.query('SELECT user_id FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    if (result[0] != undefined) {
                        userID = result[0].user_id
                        await conn.query("SELECT pseudo FROM user WHERE id = '" + userID + "'").then((result) => {

                            conn.query(`INSERT INTO logs (logs_user_id, logs_timestamp, logs_level, logs_text, logs_overlay) VALUES ('` + userID + `', '` + new Date().toISOString().slice(0, 19).replace('T', ' ') + `', 'info', '` + result[0].pseudo + ` est déconnecté du serveur websocket.', 'websocket');`);
                        })
                        await conn.query('DELETE FROM websocket WHERE websocket_id = "' + socket.id + '"')
                    }
                })

                conn.end()
            })
        }
    })

    socket.onAny((event, data, callback, callback1) => {
        console.log(event, data);
        if (event == "auth") {
            pool.getConnection().then((conn) => {
                if (data[1] != "Browsersource") {
                    conn.query("SELECT * FROM websocket WHERE user_id = '" + data[0] + "'").then((rows) => {
                        if (rows[0] == undefined) {
                            if (data[3] == undefined) {
                                conn.query('INSERT INTO websocket (websocket_id, user_id) VALUES ("' + socket.id + '","' + data[0] + '")')
                                conn.query(`INSERT INTO logs (logs_user_id, logs_timestamp, logs_level, logs_text, logs_overlay) VALUES ('` + data[0] + `', '` + new Date().toISOString().slice(0, 19).replace('T', ' ') + `', 'info', '` + data[1] + ` est connecté (` + socket.handshake.headers["x-real-ip"] + `) sur : ` + data[2] + `', 'websocket');`);
                            } else {
                                conn.query(`INSERT INTO websocket (websocket_id, user_id, overl_id) VALUES ("` + socket.id + `","` + data[0] + `","` + data[3] + `");`);
                                conn.query('SELECT pseudo FROM user WHERE id = "' + data[0] + '"').then((result) => {
                                    socket.join(data[3])
                                    conn.query(`INSERT INTO logs (logs_user_id, logs_timestamp, logs_level, logs_text, logs_overlay) VALUES ('` + data[0] + `', '` + new Date().toISOString().slice(0, 19).replace('T', ' ') + `', 'info', '` + data[1] + ` (` + socket.handshake.headers["x-real-ip"] + `) a rejoint la room : ` + result[0]["pseudo"] + `', '` + result[0]["pseudo"] + `');`);
                                })
                            }
                            conn.end()
                        } else {
                            socket.to(rows[0]["websocket_id"]).emit("logout");
                            if (data[3] == undefined) {
                                conn.query('UPDATE websocket SET websocket_id = "' + socket.id + '", overl_id = NULL WHERE user_id = "' + data[0] + '"')
                                conn.query(`INSERT INTO logs (logs_user_id, logs_timestamp, logs_level, logs_text, logs_overlay) VALUES ('` + data[0] + `', '` + new Date().toISOString().slice(0, 19).replace('T', ' ') + `', 'info', '` + data[1] + ` est connecté (` + socket.handshake.headers["x-real-ip"] + `) sur : ` + data[2] + `', 'websocket');`);
                            } else {
                                conn.query('SELECT pseudo FROM user WHERE id = "' + data[0] + '"').then((result) => {
                                    socket.join(data[3])
                                    conn.query(`INSERT INTO logs (logs_user_id, logs_timestamp, logs_level, logs_text, logs_overlay) VALUES ('` + data[0] + `', '` + new Date().toISOString().slice(0, 19).replace('T', ' ') + `', 'info', '` + data[1] + ` (` + socket.handshake.headers["x-real-ip"] + `) a rejoint la room : ` + result[0]["pseudo"] + `', '` + result[0]["pseudo"] + `');`);
                                })
                                conn.query('UPDATE websocket SET websocket_id = "' + socket.id + '", overl_id = "' + data[3] + '" WHERE user_id = "' + data[0] + '"')
                            }
                            conn.end()
                        }
                    })
                } else {
                    socket.join(data[3])
                    conn.query(`INSERT INTO logs (logs_user_id, logs_timestamp, logs_level, logs_text, logs_overlay) VALUES ('3', '` + new Date().toISOString().slice(0, 19).replace('T', ' ') + `', 'info', 'Un overlay est connecté à une room' ,'websocket');`);
                    conn.end()
                }
            })
        } else if (event.startsWith('show_')) {
            pool.getConnection().then(async (conn) => {
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    var user = ""
                    var overlay = ""
                    var overlayOwner = ""

                    // INFO: data[0] = id du Widget (int); data[1] = id du WidgetId (int) ; data[2] = libWidgetid (string)
                    console.log("Data0", data[0]);
                    console.log("Data1", data[1]);
                    console.log("Data2", data[2]);

                    // INFO: On récupère le widget selon l'id de l'overlay et l'id du widget
                    await conn.query('SELECT * FROM widgets WHERE overlay_id = "' + result[0].overl_id + '" AND id = "' + data[0] + '"').then((widget) => {
                        console.log(widget);
                        console.log("isTwoWidget", widget[0].is_two_widgets);
                        // INFO: On vérifie si le widget est un widget deux sous-widgets
                        if (widget[0].is_two_widgets == 0) {
                            conn.query('UPDATE sa_prodv4_dev.widgets SET widget_id_id="' + widget[0].widget_id_id + '", overlay_id="' + widget[0].overlay_id + '", widget_name="' + widget[0].widget_name + '", widget_visible="1", is_two_widgets="' + widget[0].is_two_widgets + '" WHERE id="' + data[0] + '";').then(updateCheck => {
                                console.log("Update ok");
                            });
                        } else {
                            if (widget[0].widget_id_id.lib_widget_id == data[2]) {
                                // INFO: Si c'est libWidgetId qui a sélectionné, on met widgetVisible à 1
                                conn.query('UPDATE sa_prodv4_dev.widgets SET widget_id_id="' + widget[0].widget_id_id + '", overlay_id="' + widget[0].overlay_id + '", widget_name="' + widget[0].widget_name + '", widget_visible="1", is_two_widgets="' + widget[0].is_two_widgets + '" WHERE id="' + data[0] + '";').then(updateCheck => {
                                    console.log("Update ok");
                                });
                            } else if (widget[0].widget_id_id.lib_widget_id2 == data[2]) {
                                // INFO: Si c'est libWidgetId2 qui a sélectionné, on met widgetVisible à 2
                                conn.query('UPDATE sa_prodv4_dev.widgets SET widget_id_id="' + widget[0].widget_id_id + '", overlay_id="' + widget[0].overlay_id + '", widget_name="' + widget[0].widget_name + '", widget_visible="2", is_two_widgets="' + widget[0].is_two_widgets + '" WHERE id="' + data[0] + '";').then(updateCheck => {
                                    console.log("Update ok");
                                });
                            }
                        }
                    });
                    if(event == 'show_tweets'){
                        conn.query('SELECT m.meta_value FROM sa_prodv4_dev.meta m LEFT JOIN sa_prodv4_dev.widgets w  ON m.id = w.id LEFT JOIN sa_prodv4_dev.`overlay` o ON w.overlay_id = o.id WHERE o.id = '+result[0].overl_id).then(async (tweet) =>{
                            console.log(tweet[0].meta_value)
                            conn.query('SELECT * FROM tweet WHERE id = '+ tweet[0].meta_value).then(async (infotweet) => {
                                socket.to(result[0].overl_id.toString()).emit(event, infotweet[0].tweet_media_type)
                            })
                        })//récupérer type média tweet
                    }else{
                        socket.to(result[0].overl_id.toString()).emit(event)
                    }
                })
                conn.end()
            })
        } else if (event.startsWith('off_')) {
            pool.getConnection().then(async (conn) => {
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    var user = ""
                    var overlay = ""
                    var overlayOwner = ""

                    // INFO: data[0] = id du Widget (int); data[1] = id du WidgetId (int) ; data[2] = libWidgetid (string)
                    console.log("Data0", data[0]);
                    console.log("Data1", data[1]);
                    console.log("Data2", data[2]);

                    // INFO: On récupère le widget selon l'id de l'overlay et l'id du widget
                    await conn.query('SELECT * FROM widgets WHERE overlay_id = "' + result[0].overl_id + '" AND id = "' + data[0] + '"').then((widget) => {
                        console.log(widget);
                        conn.query('UPDATE sa_prodv4_dev.widgets SET widget_id_id="' + widget[0].widget_id_id + '", overlay_id="' + widget[0].overlay_id + '", widget_name="' + widget[0].widget_name + '", widget_visible="0", is_two_widgets="' + widget[0].is_two_widgets + '" WHERE id="' + data[0] + '";').then(updateCheck => {
                            console.log("Update ok");
                        });
                    });
                    if(event == 'off_tweets'){
                        conn.query('SELECT m.meta_value FROM sa_prodv4_dev.meta m LEFT JOIN sa_prodv4_dev.widgets w  ON m.id = w.id LEFT JOIN sa_prodv4_dev.`overlay` o ON w.overlay_id = o.id WHERE o.id = '+result[0].overl_id).then(async (tweet) =>{
                            console.log(tweet[0].meta_value)
                            conn.query('SELECT * FROM tweet WHERE id = '+ tweet[0].meta_value).then(async (infotweet) => {
                                socket.to(result[0].overl_id.toString()).emit(event, infotweet[0].tweet_media_type)
                            })
                        })//récupérer type média tweet
                    }else{
                        socket.to(result[0].overl_id.toString()).emit(event)
                    }
                })
                conn.end()
            })
        } else if (event.startsWith('auto_off_')) {
            pool.getConnection().then(async (conn) => {
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    var user = ""
                    var overlay = ""
                    var overlayOwner = ""

                    // INFO: data[0] = id du Widget (int); data[1] = id du WidgetId (int) ; data[2] = libWidgetid (string), data[3] = idOverlay (int)
                    console.log("Data0", data[0]);
                    console.log("Data1", data[1]);
                    console.log("Data2", data[2]);
                    console.log("Data3", data[3]);

                    // INFO: On récupère le widget selon l'id de l'overlay et l'id du widget
                    await conn.query('SELECT * FROM widgets WHERE overlay_id = "' + data[3] + '" AND id = "' + data[0] + '"').then((widget) => {
                        console.log(widget);
                        conn.query('UPDATE sa_prodv4_dev.widgets SET widget_id_id="' + widget[0].widget_id_id + '", overlay_id="' + widget[0].overlay_id + '", widget_name="' + widget[0].widget_name + '", widget_visible="0", is_two_widgets="' + widget[0].is_two_widgets + '" WHERE id="' + data[0] + '";').then(updateCheck => {
                            console.log("Update ok");
                        });
                    });
                    socket.to(data[3].toString()).emit(event)
                })
                conn.end()
            })
        } else if (event == "refresh") {
            pool.getConnection().then(async (conn) => {
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    socket.to(result[0].overl_id.toString()).emit(event)
                })
                conn.end()
            })
        } else if (event == "update") {
            //data[0] = le widget concerné
            //data[1] = sa valeur
            pool.getConnection().then(async (conn) => {
                // await conn.query(REQUETE A CONSTRUIRE).then(async (result) => {
                // })

                // INFO: Récupérer la méta sélectionnée dans le widget grâce à l'id de l'overlay lié au socketLog
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    console.log(result[0].overl_id);
                    console.log('Data0 : ' + data[0]);
                    console.log('Data1 : ' + data[1]);
                    let widget_id = data[0].replace('_MetaValue', '');
                    console.log('Widget_id : ' + widget_id);
                    await conn.query('SELECT sa_prodv4_dev.meta.id AS idMeta FROM sa_prodv4_dev.meta INNER JOIN sa_prodv4_dev.widgets ON sa_prodv4_dev.meta.widgets_id = sa_prodv4_dev.widgets.id INNER JOIN sa_prodv4_dev.lib_widgets ON sa_prodv4_dev.widgets.widget_id_id  = sa_prodv4_dev.lib_widgets.id WHERE meta_key = "' + widget_id + '" and sa_prodv4_dev.widgets.overlay_id = "' + result[0].overl_id + '"').then((metaId) => {
                        console.log("MetaId : " + metaId[0].idMeta);
                        conn.query('UPDATE sa_prodv4_dev.meta SET meta_value="' + data[1] + '" WHERE id="' + metaId[0].idMeta + '";').then((test) => {
                            console.log('Data : ' + data[1]);
                            socket.to(result[0].overl_id.toString()).emit(event + "_" + data[0], (data[1]));
                        })
                    })
                })
                conn.end()
            })


            console.log(data)
            console.log(callback)
        } else if (event == "update_player_ninja") {
            //data[0] = le widget concerné
            //data[1] = sa valeur
            //data[2] = l'id du player via GET
            pool.getConnection().then(async (conn) => {
                // await conn.query(REQUETE A CONSTRUIRE).then(async (result) => {
                // })

                // INFO: Récupérer l'overlayId
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    console.log(result[0].overl_id);
                    console.log('Data0 : ' + data[0]);
                    console.log('Data1 : ' + data[1]);
                    console.log('Data2 : ' + data[2]);

                    // INFO: Récupérer le player selon son id récupéré en GET
                    await conn.query('SELECT * FROM player WHERE id = "' + data[2] + '"').then(async (player) => {
                        // INFO: Mettre à jour le player
                        await conn.query('UPDATE sa_prodv4_dev.player SET player_name="' + player[0].player_name + '", player_id_obs_ninja="' + data[1] + '" WHERE id="' + data[2] + '"; ')
                    })
                })
                conn.end()
            })


            console.log(data)
            console.log(callback)
        } else if (event == "update_current_event") {
            //data[0] = le widget concerné
            //data[1] = sa valeur
            pool.getConnection().then(async (conn) => {
                // await conn.query(REQUETE A CONSTRUIRE).then(async (result) => {
                // })

                // INFO: Récupérer l'id du currentEvent sélectionné pour mettre à jour le currentEventId dans Overlay
                console.log(data[0]);
                console.log(data[1]);
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    console.log('OverlayId : ' + result[0].overl_id);
                    console.log('Data0 : ' + data[0]);
                    console.log('Data1 : ' + data[1]);

                    // INFO: On récupère les data de l'overlay
                    await conn.query('SELECT * FROM sa_prodv4_dev.overlay WHERE id = "' + result[0].overl_id + '"').then(async (overlay) => {
                        // INFO: On update l'overlay
                        await conn.query('UPDATE sa_prodv4_dev.overlay SET overlay_owner_id="' + overlay[0].overlay_owner_id + '", overlay_name="' + overlay[0].overlay_name + '", current_event_id="' + data[1] + '" WHERE id="' + result[0].overl_id + '";')
                        socket.to(result[0].overl_id.toString()).emit(event, (data[1]));
                    })

                })
                conn.end()
            })


            console.log(data)
            console.log(callback)
        } else if (event == "update_current_game") {
            //data[0] = le widget concerné
            //data[1] = sa valeur
            pool.getConnection().then(async (conn) => {
                // await conn.query(REQUETE A CONSTRUIRE).then(async (result) => {
                // })

                // INFO: Récupérer l'id de la currentGame pour mettre à jour le currentGame dans Event
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    console.log('OverlayId : ' + result[0].overl_id);
                    console.log('Data0 : ' + data[0]);
                    console.log('Data1 : ' + data[1]);

                    // INFO: On récupère les data de l'overlay
                    await conn.query('SELECT * FROM sa_prodv4_dev.overlay WHERE id = "' + result[0].overl_id + '"').then(async (overlay) => {
                        console.log('CurrentEventId : ' + overlay[0].current_event_id);
                        // INFO: On récupère les data de l'event
                        await conn.query('SELECT * FROM sa_prodv4_dev.event WHERE id = "' + overlay[0].current_event_id + '"').then(async (event_data) => {
                            console.log('Event Id : ' + event_data[0].event_edition_id);
                            let startDate = new Date(event_data[0].event_start_date);
                            //2022-05-16 11:13:52.000
                            let startDateTime = moment(startDate).format('YYYY-MM-DD HH:mm:ss.SSS');
                            let endDate = new Date(event_data[0].event_end_date);
                            let endDateTime = moment(endDate).format('YYYY-MM-DD HH:mm:ss.SSS');
                            console.log('StartDate : ' + startDate);
                            console.log('startDateTime : ' + startDateTime);
                            // INFO: On update l'event
                            await conn.query('UPDATE sa_prodv4_dev.event SET event_edition_id="' + event_data[0].event_edition_id + '", user_id_id="' + event_data[0].user_id_id + '", event_format_id="' + event_data[0].event_format_id + '", overlay_id_id="' + result[0].overl_id + '", event_name="' + event_data[0].event_name + '", event_hashtag="' + event_data[0].event_hashtag + '", event_logo="' + event_data[0].event_logo + '", event_slots="' + event_data[0].event_slots + '", event_cashprize="' + event_data[0].event_cashprize + '", event_start_date="' + startDateTime + '", event_end_date="' + endDateTime + '", current_game_id="' + data[1] + '" WHERE id="' + event_data[0].id + '";')
                            socket.to(result[0].overl_id.toString()).emit(event, (data[1]));
                        })
                    })

                })
                conn.end()
            })


            console.log(data)
            console.log(callback)
        } else if (event == "update_next_game") {
            //data[0] = le widget concerné
            //data[1] = sa valeur
            pool.getConnection().then(async (conn) => {
                // await conn.query(REQUETE A CONSTRUIRE).then(async (result) => {
                // })

                // INFO: Récupérer l'id de la currentGame pour mettre à jour le currentGame dans Event
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    console.log('OverlayId : ' + result[0].overl_id);
                    console.log('Data0 : ' + data[0]);
                    console.log('Data1 : ' + data[1]);

                    // INFO: On récupère les data de l'overlay
                    await conn.query('SELECT * FROM sa_prodv4_dev.overlay WHERE id = "' + result[0].overl_id + '"').then(async (overlay) => {
                        console.log('CurrentEventId : ' + overlay[0].current_event_id);
                        // INFO: On récupère les data de l'event
                        await conn.query('SELECT * FROM sa_prodv4_dev.event WHERE id = "' + overlay[0].current_event_id + '"').then(async (event_data) => {
                            console.log('Event Id : ' + event_data[0].event_edition_id);
                            let startDate = new Date(event_data[0].event_start_date);
                            //2022-05-16 11:13:52.000
                            let startDateTime = moment(startDate).format('YYYY-MM-DD HH:mm:ss.SSS');
                            let endDate = new Date(event_data[0].event_end_date);
                            let endDateTime = moment(endDate).format('YYYY-MM-DD HH:mm:ss.SSS');
                            console.log('StartDate : ' + startDate);
                            console.log('startDateTime : ' + startDateTime);
                            // INFO: On update l'event
                            await conn.query('UPDATE sa_prodv4_dev.event SET event_edition_id="' + event_data[0].event_edition_id + '", user_id_id="' + event_data[0].user_id_id + '", event_format_id="' + event_data[0].event_format_id + '", overlay_id_id="' + result[0].overl_id + '", event_name="' + event_data[0].event_name + '", event_hashtag="' + event_data[0].event_hashtag + '", event_logo="' + event_data[0].event_logo + '", event_slots="' + event_data[0].event_slots + '", event_cashprize="' + event_data[0].event_cashprize + '", event_start_date="' + startDateTime + '", event_end_date="' + endDateTime + '", current_game_id="' + event_data[0].current_game_id + '", next_game_id="' + data[1] + '" WHERE id="' + event_data[0].id + '";')
                            await conn.query('SELECT * FROM game WHERE id = "' + data[1] + '";').then(async (game_data) => {
                                await conn.query('SELECT * FROM team WHERE id = "' + game_data[0].game_id_team_alpha_id + '";').then(async (team_alpha) => {
                                    await conn.query('SELECT * FROM team WHERE id = "' + game_data[0].game_id_team_beta_id + '";').then(async (team_beta) => {
                                        socket.to(result[0].overl_id.toString()).emit(event, [data[1], team_alpha[0].team_name, team_beta[0].team_name]);
                                    });
                                });
                            })
                        })
                    })

                })
                conn.end()
            })


            console.log(data)
            console.log(callback)
        } else if (event == "update_current_map") {
            //data[0] = le widget concerné
            //data[1] = sa valeur
            pool.getConnection().then(async (conn) => {
                console.log('Data0 : ' + data[0]);
                console.log('Data1 : ' + data[1]);

                // INFO: On récupère le currentEvent à partir de l'overlay
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    console.log('OverlayId : ' + result[0].overl_id);

                    // INFO: On récupère le currentEvent à partir de l'id de l'overlay
                    await conn.query('SELECT * FROM overlay WHERE id = "' + result[0].overl_id + '"').then(async (overlay) => {
                        console.log('CurrentEventId : ' + overlay[0].current_event_id);
                        // INFO: on récupère le currentGame à partir de l'id du currentEvent
                        await conn.query('SELECT * FROM event WHERE id = "' + overlay[0].current_event_id + '"').then(async (event_data) => {
                            console.log('currentGameId : ' + event_data[0].current_game_id);
                            // INFO: On récupère le currentMap à partit de l'id de la currentGame
                            await conn.query('SELECT * FROM game WHERE id = "' + event_data[0].current_game_id + '"').then(async (game_data) => {
                                console.log('currentMapId : ' + game_data[0].id);
                                // INFO: On récupère les data de la map
                                await conn.query('SELECT * FROM map WHERE id = "' + data[1] + '"').then(async (map_data) => {
                                    // INFO: On update le currentMap
                                    conn.query('UPDATE game SET current_map_id="' + data[1] + '" WHERE id="' + game_data[0].id + '";')
                                    socket.to(result[0].overl_id.toString()).emit(event, (map_data[0].map_name));
                                })
                            })
                        })
                    })
                })
                conn.end()
            })


            console.log(data)
            console.log(callback)
        } else if (event == 'update_game_score_alpha') {
            pool.getConnection().then(async (conn) => {
                console.log('Data0 : ' + data[0]);
                console.log('Data1 : ' + data[1]);

                // INFO: On récupère le currentEvent à partir de l'overlay
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    console.log('OverlayId : ' + result[0].overl_id);

                    // INFO: On récupère le currentEvent à partir de l'id de l'overlay
                    await conn.query('SELECT * FROM overlay WHERE id = "' + result[0].overl_id + '"').then(async (overlay) => {
                        console.log('CurrentEventId : ' + overlay[0].current_event_id);
                        // INFO: on récupère le currentGame à partir de l'id du currentEvent
                        await conn.query('SELECT * FROM event WHERE id = "' + overlay[0].current_event_id + '"').then(async (event_data) => {
                            console.log('currentGameId : ' + event_data[0].current_game_id);
                            // INFO: On récupère le currentMap à partit de l'id de la currentGame
                            await conn.query('SELECT * FROM game WHERE id = "' + event_data[0].current_game_id + '"').then(async (game_data) => {
                                conn.query('UPDATE game SET game_score_team_alpha="' + data[1] + '" WHERE id="' + game_data[0].id + '";')
                                socket.to(result[0].overl_id.toString()).emit(event, (data[1]));
                            })
                        })
                    })
                })
                conn.end()
            })
        } else if (event == 'update_game_score_beta') {
            pool.getConnection().then(async (conn) => {
                console.log('Data0 : ' + data[0]);
                console.log('Data1 : ' + data[1]);

                // INFO: On récupère le currentEvent à partir de l'overlay
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    console.log('OverlayId : ' + result[0].overl_id);

                    // INFO: On récupère le currentEvent à partir de l'id de l'overlay
                    await conn.query('SELECT * FROM overlay WHERE id = "' + result[0].overl_id + '"').then(async (overlay) => {
                        console.log('CurrentEventId : ' + overlay[0].current_event_id);
                        // INFO: on récupère le currentGame à partir de l'id du currentEvent
                        await conn.query('SELECT * FROM event WHERE id = "' + overlay[0].current_event_id + '"').then(async (event_data) => {
                            console.log('currentGameId : ' + event_data[0].current_game_id);
                            // INFO: On récupère le currentMap à partit de l'id de la currentGame
                            await conn.query('SELECT * FROM game WHERE id = "' + event_data[0].current_game_id + '"').then(async (game_data) => {
                                conn.query('UPDATE game SET game_score_team_beta="' + data[1] + '" WHERE id="' + game_data[0].id + '";')
                                socket.to(result[0].overl_id.toString()).emit(event, (data[1]));
                            })
                        })
                    })
                })
                conn.end()
            })
        } else if (event == 'reload') {
            console.log('reload')
            console.log(data)
            socket.to(data).emit('refresh')
        } else if (event == 'twitter_gettweets') {
            console.log('get tweets')
            pool.getConnection().then(async (conn) => {
                conn.query('SELECT * FROM tweet ORDER BY id DESC').then((rows) => {
                    socket.emit("twitter_answer", rows)
                })
                // await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                //     console.log(result['user_id'])
                // })
                conn.end()
            })
        } else if (event == 'twitter_selecttweet') {
            pool.getConnection().then(async (conn) => {
                await conn.query('SELECT * FROM websocket WHERE websocket_id = "' + socket.id + '"').then(async (result) => {
                    conn.query('UPDATE sa_prodv4_dev.meta m LEFT JOIN sa_prodv4_dev.widgets w  ON m.id = w.id LEFT JOIN sa_prodv4_dev.`overlay` o ON w.overlay_id = o.id SET meta_key="tweet_id", meta_value="' + data + '" WHERE o.id = ' + result[0].overl_id)

                    conn.query("SELECT * FROM tweet WHERE id = " + data).then(async (tweet) => {
                        socket.to(result[0].overl_id.toString()).emit('tweet_selected', tweet[0])
                    })
                    conn.end()
                })
            })
        } else if (event == 'twitter_deletetweet') {
            pool.getConnection().then((conn) => {
                conn.query("DELETE FROM tweet WHERE id = " + data)
                conn.end()
            })
        } else if (event == "twitter_start") {
            socket.join('twitter')
        }

        if (callback != null && callback1 == null) {
            callback()
        } else if (callback1 != null) {
            callback1()
        }
    })
});

process.on('uncaughtException', async (err) => {
    await pool.getConnection().then(async (conn) => {
        conn.query(`INSERT INTO logs (logs_user_id, logs_timestamp, logs_level, logs_text, logs_overlay) VALUES ("4", '` + new Date().toISOString().slice(0, 19).replace('T', ' ') + `', 'error', '` + "Le serveur websocket à planté : " + err + `', 'websocket');`);
        conn.query('TRUNCATE TABLE websocket')
        await conn.end()
    }).then(() => {
        console.error('Erreur :', err)
        process.exit(1)
    })
})