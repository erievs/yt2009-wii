const fetch = require("node-fetch")
const constants = require("./yt2009constants.json")
const yt2009templates = require("./yt2009templates")
const config = require("./config.json")
const fs = require("fs")
const playlist_html = fs.readFileSync("../playlist.htm").toString();
const doodles = require("./yt2009doodles")
const language = require("./language_data/language_engine")
const utils = require("./yt2009utils")
const mobileauths = require("./yt2009mobileauths")

let cache = require("./cache_dir/playlist_cache_manager")

module.exports = {
    "innertube_get_data": function(id, callback) {
        fetch(`https://www.youtube.com/youtubei/v1/browse?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`, {
            "headers": constants.headers,
            "referrer": `https://www.youtube.com/`,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": JSON.stringify({
                "browseId": "VL" + id,
                "context": constants.cached_innertube_context
            }),
            "method": "POST",
            "mode": "cors"
        }).then(r => {r.json().then(r => {
            callback(r)
        })})
    },


    "applyPlaylistHTML": function(data, req) {
        let code = playlist_html;

        code = require("./yt2009loginsimulate")(req, code, true)

        let vids = utils.bareCount(data.videoCount) + "lang_results_playlist_video_suffix"

        code = code.replace("yt2009_playlist_name", data.name)
        code = code.replace("yt2009_playlist_description", data.description)
        code = code.split("yt2009_videos_count").join(vids)
        code = code.replace("yt2009_last_update", data.lastUpdate)
        code = code.replace("yt2009_playlist_views", data.views)
        code = code.replace("yt2009_creator_link", data.creatorUrl)
        code = code.replace("yt2009_creator_name", data.creatorName)
        code = code.replace(
            "yt2009_playlistlink",
            "http://www.youtube.com/view_play_list?p=" + data.playlistId
        )

        // create and throw in playlist embed
        let playlist_embed_url = "http://www.youtube.com/swf/cpb.swf?"
        if(data.videos[0]) {
            playlist_embed_url += "player_id=" + data.videos[0].id + "&"
        }
        playlist_embed_url += "datatype=playlist&"
        playlist_embed_url += "data=" + data.playlistId + "&"
        playlist_embed_url += "BASE_YT_URL=http://" + config.ip + ":" + config.port + "/"
        code = code.replace(
            "yt2009_cpburl",
            playlist_embed_url
        )
        code = code.replace("yt2009_config_hostname", config.ip)
        code = code.replace("yt2009_config_port", config.port)

        if((req.headers.cookie || "").includes("shows_tab")) {
            // shows tab
            code = code.replace(
                `<a href="/channels">lang_channels</a>`,
                `<a href="/channels">lang_channels</a><a href="#">lang_shows</a>`
            )
        }

        let videos_html = ``
        data.videos.forEach(video => {
            videos_html += yt2009templates.playlistVideo(
                video, data.playlistId, req.protocol
            )
        })

        if(data.videos[0]) {
            code = code.replace(
                "/yt2009_playlist_thumbnail", data.videos[0].thumbnail
            )
            code = code.split("yt2009_watch_all_link").join(
                `/watch?v=${data.videos[0].id}&list=${data.playlistId}`
            )
        } else {
            code = code.split("yt2009_watch_all_link").join(`/`)
        }

        code = code.replace(`<!--yt2009_video_entries-->`, videos_html)
        code = doodles.applyDoodle(code)
        code = language.apply_lang_to_code(code, req)

        return code;
    },

    "parsePlaylist": function(playlistId, callback) {
        // Check if the playlist is in cache
        if (cache.read()[playlistId]) {
            let cachedData = JSON.parse(JSON.stringify(cache.read()[playlistId]));
            callback(cachedData);
            return cachedData;
        } else {
            let videoList = {
                "name": "",
                "videos": [],
                "views": "",
                "creatorName": "",
                "creatorUrl": "",
                "description": "",
                "lastUpdate": "",
                "videoCount": "",
                "playlistId": playlistId
            };

            // Fetch playlist data
            this.innertube_get_data(playlistId, (r) => {
                // Error handling: Check if the response structure matches what we expect
                if (!r || !r.contents || !r.contents.twoColumnBrowseResultsRenderer) {
                    console.error("Invalid response structure: ", r);
                    return callback({ error: "Playlist data is unavailable" });
                }

                let playlistArray;
                try {
                    playlistArray = r.contents.twoColumnBrowseResultsRenderer
                                    .tabs[0].tabRenderer.content
                                    .sectionListRenderer.contents[0]
                                    .itemSectionRenderer.contents[0]
                                    .playlistVideoListRenderer.contents;
                } catch (error) {
                    console.error("Failed to parse playlist array: ", error);
                    return callback({ error: "Failed to parse playlist data" });
                }

                // Metadata extraction
                let primarySidebar, owner = "", vidCount = "", lastUpdate = "";

                try {
                    primarySidebar = r.sidebar.playlistSidebarRenderer.items[0]
                                    .playlistSidebarPrimaryInfoRenderer;
                    owner = r.sidebar.playlistSidebarRenderer.items[1]
                            .playlistSidebarSecondaryInfoRenderer.videoOwner
                            .videoOwnerRenderer.title.runs[0];

                    // Extract video count and last update time
                    primarySidebar.stats[0].runs.forEach(run => {
                        vidCount += run.text;
                    });
                    primarySidebar.stats[2].runs.forEach(run => {
                        lastUpdate += run.text;
                    });
                } catch (error) {
                    console.error("Failed to extract playlist metadata: ", error);
                }

                // Fill the videoList object with metadata
                try {
                    videoList.name = primarySidebar.title.runs[0].text;
                    videoList.views = primarySidebar.stats[1].simpleText;
                    videoList.creatorName = owner.text;
                    videoList.creatorUrl = owner.navigationEndpoint
                                        ? owner.navigationEndpoint.browseEndpoint.canonicalBaseUrl
                                        : "#";
                    videoList.description = primarySidebar.description
                                        ? primarySidebar.description.simpleText.split("\n")
                                            .splice(0, 3).join("<br>")
                                        : "";
                    videoList.lastUpdate = lastUpdate;
                    videoList.videoCount = vidCount;
                } catch (error) {
                    console.error("Error filling videoList metadata: ", error);
                }

                // Fill the videos array
                try {
                    playlistArray.forEach(video => {
                        if (!video.playlistVideoRenderer) return;
                        video = video.playlistVideoRenderer;
                        videoList.videos.push({
                            "id": video.videoId,
                            "title": video.title.runs[0].text,
                            "thumbnail": "http://i.ytimg.com/vi/" + video.videoId + "/hqdefault.jpg",
                            "uploaderName": video.shortBylineText.runs[0].text,
                            "uploaderUrl": video.shortBylineText.runs[0]
                                            .navigationEndpoint.browseEndpoint.canonicalBaseUrl,
                            "time": video.lengthText ? video.lengthText.simpleText : "",
                            "views": utils.approxSubcount(
                                video.videoInfo.runs[0].text.split(" ")[0]
                            )
                        });
                    });
                } catch (error) {
                    console.error("Error processing playlist videos: ", error);
                }

                // Cache the result
                cache.write(playlistId, JSON.parse(JSON.stringify(videoList)));

                // Return the result via callback
                callback(cache.read()[playlistId]);
            });
        }
    },


    "create_cpb_xml": function(req, res) {
        let compatAuth = false;
        if((req.headers.referer && req.headers.referer.includes(".swf"))
        || (req.headers["user-agent"]
        && req.headers["user-agent"].includes("Shockwave Flash"))) {
            compatAuth = true;
        }
        if(!compatAuth && !mobileauths.isAuthorized(req, res, "feed")) return;
        let id = req.originalUrl.split("playlists/")[1].split("?")[0]
        let xmlResponse = ""
        this.parsePlaylist(id, (data) => {
            xmlResponse += yt2009templates.cpbPlaylistsBegin(
                data.name,
                data.playlistId,
                data.creatorName
            )

            xmlResponse += yt2009templates.cpbPlaylistsCounts(
                (Array.isArray(data.videos) ? data.videos.length : 0),  
                data.playlistId,
                data.name,
                data.description || "No description available"  
            );

            let videoIndex = 1;

            if (Array.isArray(data.videos) && data.videos.length > 0) { 
                data.videos.forEach(video => {
                    xmlResponse += yt2009templates.cpbVideo(video, videoIndex);
                    videoIndex += 1;
                });
            } else {
                console.warn("No videos available in the playlist.");
                xmlResponse += "<p>No videos available in this playlist.</p>";  
            }            

            xmlResponse += `
            </feed>`

            res.set("content-type", "application/atom+xml")
            res.send(xmlResponse)
        })
    }
}