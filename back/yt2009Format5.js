const yt2009main = require("./yt2009html");
const yt2009search = require("./yt2009search");
const yt2009templates = require("./yt2009templates");
const video_exists = require("./cache_dir/video_exists_cache_mgr");
const ryd = require("./cache_dir/ryd_cache_manager");
const fs = require("fs");
const utils = require("./yt2009utils");
const child_process = require("child_process");
const config = require("./config.json");

let flvProcessingVideos = [];

const convert_mp4_to_flv = (id, callback) => {
    const inputFilePath = `${__dirname}/../assets/${id}.mp4`;
    const outputFilePath = `${__dirname}/../assets/${id}.flv`;

    const ffmpegCommandFlv = [
        "ffmpeg",
        "-v", "verbose",
        "-i", inputFilePath,
        "-c:v", "libx264",
        "-b:v", "250k",
        "-vf", "scale=426:240",
        "-aspect", "4:3",
        "-pix_fmt", "yuv420p",
        "-c:a", "libmp3lame",
        "-b:a", "64k",
        "-r", "30",
        outputFilePath
    ].join(" ");

    const startTime = Date.now();

    child_process.exec(ffmpegCommandFlv, (error, stdout, stderr) => {
        const endTime = Date.now();
        const processingTime = ((endTime - startTime) / 1000).toFixed(2);

        flvProcessingVideos = flvProcessingVideos.filter(s => s !== id);
        if (error) {
            console.error(`Error processing video ${id}:`, error);
            console.error(`stderr: ${stderr}`);

            if (fs.existsSync(outputFilePath)) {
                fs.unlinkSync(outputFilePath);
                console.log(`Deleted failed FLV file for video ${id}`);
            }
            callback(false);
        } else {
            console.log(`Video ${id} processed successfully in ${processingTime} seconds.`);
            callback(true);
        }
    });
};

module.exports = {
    get_video(req, res) {
        if (!utils.isAuthorized(req)) {
            res.send("");
            return;
        }

        const videoId = req.query.video_id.replace("/mp4", "");

        if (config.env === "dev") {
            console.log(`(${utils.get_used_token(req) + "_warp_swf"}) warp init (${Date.now()})`);
        }

        yt2009main.fetch_video_data(videoId, (data) => {
            res.send(`
<?xml version="1.0" encoding="utf-8"?>
<ut_response status="ok">
    <video>
        <author>${data.author_name}</author>
        <id>${videoId}</id>
        <title>${data.title}</title>
        <length_seconds>${data.length}</length_seconds>
        <rating_avg>5</rating_avg>
        <rating_count>1</rating_count>
        <description>.</description>
        <view_count>1</view_count>
        <upload_time>1</upload_time>
        <comment_count>1</comment_count>
        <tags></tags>
        <url>http://</url>
        <thumbnail_url>http://</thumbnail_url>
        <embed_status>ok</embed_status>
        <allow_ratings>yes</allow_ratings>
    </video>
</ut_response>`);
        }, req.headers["user-agent"], utils.get_used_token(req), false, false, true);
    },

    get_related(req, res) {
        if (!utils.isAuthorized(req)) {
            res.send("");
            return;
        }

        const videoId = req.query.video_id.replace("/mp4", "");

        if (config.env === "dev") {
            console.log(`(${utils.get_used_token(req) + "_warp_swf"}) warp videos load (${videoId}, ${Date.now()})`);
        }

        let videosXml = `<?xml version="1.0" encoding="utf-8"?>
<ut_response status="ok">
<video_list>`;

        yt2009main.fetch_video_data(videoId, (data) => {
            yt2009search.related_from_keywords(
                utils.exp_related_keyword(data.tags, data.title),
                videoId, "", (html, related) => {
                    related.forEach((v, index) => {
                        videosXml += yt2009templates.warpVideo(
                            v.id,
                            v.title,
                            v.length,
                            v.creatorHandle || v.creatorName,
                            index + 1,
                            v.description,
                            v.views,
                            ryd.readCache(v.id) || 5,
                            v.upload
                        );
                    });

                    videosXml += `
</video_list>
</ut_response>`;
                    res.send(videosXml);
                }, "http");
        }, req.headers["user-agent"], utils.get_used_token(req), false, false, true);
    },

    get_flv(req, res) {
        const videoId = req.query.video_id;

        if (!videoId) {
            res.sendStatus(400);
            return;
        }

        const sanitizedVideoId = videoId.replace("/mp4", "");

        this.vid_flv(sanitizedVideoId, (success) => {
            if (success) {
                try {
                    res.redirect(`../assets/${sanitizedVideoId}.flv`);
                } catch (error) {
                    console.error(`Error redirecting to flv file:`, error);
                }
            } else {
                console.log(`Video ${sanitizedVideoId} could not be processed.`);
                res.status(500).send("Error processing video.");
            }
        });
    },

    vid_flv(id, callback) {
        if (flvProcessingVideos.includes(id)) {
            console.log(`Video ${id} is already being processed. Skipping duplicate request.`);
            return;
        }

        flvProcessingVideos.push(id);

        const inputFilePath = `${__dirname}/../assets/${id}.mp4`;
        const outputFilePath = `${__dirname}/../assets/${id}.flv`;

        if (!fs.existsSync(inputFilePath)) {
            console.error(`Input file ${inputFilePath} does not exist.`);

            flvProcessingVideos = flvProcessingVideos.filter(s => s !== id);
            callback(false);
            return;
        }

        if (fs.existsSync(outputFilePath)) {
            console.log(`FLV file ${outputFilePath} already exists. Skipping processing.`);
            callback(true);
            return;
        }

        console.log(`Processing FLV for video ${id}...`);

        convert_mp4_to_flv(id, callback);
    }
};
