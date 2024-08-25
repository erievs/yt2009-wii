# NextTube - A Project Aimed To Revive The YouTube Channel For The Wii!

  # linux users

   [linux_setup.pdf](linux_setup.pdf)

  # windows users

    I may make a Windows guide at some point.

## optional after-setup steps

### - **if experiencing issues with ytdl-core, apply this pull. https://github.com/fent/node-ytdl-core/pull/1217**

**as of november 2023, it still isn't merged with the main repo.**

- set up an android app by following [apk_setup.md](apk_setup.md)

---

## updating

if you want to update your frontend instance, use

```
git pull --no-commit
```

to get you up with updates you may have missed.

if you modified the code yourself and you're getting a merge conflict, use

```
git checkout -- <file>
```

to restore the original file. you can make a copy of your modified file and reapply the mod after the pull is done.

---

## usage

now that you're in, you can just use it as it is, but there is a bit more you can do.

navigate to **/flags** to change settings locally. here, for example, you can set up The Wayback Machine as a video data source. but look through, there is a lot more.

feel free to nav to **/toggle_f** if you've set up flash players as described above to make the frontend work on older browsers, such as ie6.

and just click around! you might find some useful features you didn't expect to work.

---

**over time, depending on your usage, yt2009 may take up a lot of space (counted in tens of gigabytes!)**

**if you need to reclaim space, look through the assets folder where downloaded files (such as images, videos) are saved and delete ones you need.**

**they will be redownloaded when necessary.**

---

## notes, docs

over time some tools and documentation was written about yt2009. for an easy reference, those are listed below.

- [apk_setup.md](apk_setup.md) - set early youtube android APKs to work with yt2009
- [config_params.md](config_params.md) - a list of ALL available config options.
- [docker.md](docker.md) - yt2009 setup with docker. also listed in the setup section. (thanks, breakgimme!)
- [flash_additions.md](flash_additions.md) - some info on caption and annotations modules within the default 2009 flash player.
- [flash_player_patch.md](flash_player_patch.md) - manual patch info for using flash players with yt2009.


- [autoapk.js](autoapk.js) - a node cli file to automatically patch APKs supported by yt2009. your mileage may vary.
