# TransitLab v0.5 public video capture

Recorded 2026-09-14 from `https://ai-builderkack-traffic-lab.onrender.com/` in an isolated Playwright Chromium session. App `0.5.0`; Command `0.3`; SceneAction `0.2`; source fingerprint `4c6d083172e4`; deployed commit `038a9ef`.

## Result

- Final MP4: `output/playwright/transitlab-v05-demo-final.mp4`.
- Duration: 132 seconds, below the project's three-minute target.
- H.264, 25 fps, 1600 × 1090 (1600 × 1000 page plus 90-pixel caption band), no audio.
- Uncut real-time public-page recording; request latency is retained.
- English captions explicitly disclose the deterministic adapter and shadow-only real LLM.
- Ten accepted UI commands, one schema rejection. Rejected state unchanged; console/page errors during recording: zero.
- No business code, protocol, model settings or Render configuration changed for recording.

## Actual action results

Seconds below are relative to the browser interaction function, not frame-accurate subtitle boundaries. The capture includes recorder startup/stop overhead.

| Result time | Command | Status / effect |
| --- | --- | --- |
| 10.131 | 增加一辆公交车 | accepted; buses 1 → 2 |
| 14.206 | 增加一辆公交车 | accepted; buses 2 → 3 |
| 21.284 | 增加一辆公交车 | accepted; buses 3 → 4 |
| 33.865 | 把信号灯改成红色 | accepted; EW red / NS green observed after clearance |
| 48.423 | 让公交车停下 | accepted; all four displayed manual stop |
| 55.182 | 让公交车继续行驶 | accepted; running true, controller still gates right-of-way |
| 64.937 | 让天气下雨 | accepted; rain |
| 73.156 | 让天气下暴雪 | accepted; snow (one mode, no intensity parameter) |
| 82.930 | 让天气起雾 | accepted; fog |
| 94.802 | 恢复晴天 | accepted; clear |
| 106.452 | 让天气下陨石 | rejected at schema; `unknown action_type` |

Meteor before and after were both `{buses: 4, traffic_light: 红灯, bus_running: true, weather: clear}`. Animation was intentionally paused during this comparison. The separate public acceptance check additionally compared paused canvas pixels for two rejected commands.

## Inspection

The complete encoded stream was decoded without FFmpeg errors. One frame per second across the full 132-second video was arranged in four review sheets and visually checked, with full-resolution snow and Event Log frames checked for legibility and caption placement. No private tabs, accounts, keys or desktop notifications were recorded. Black unused cells at the end of the final contact sheet are tile padding, not video frames.

This is sampled visual QC plus full-stream decode, not a claim of continuous human playback. There is no audio track to review.

## Reproduction and limitations

Use an isolated Playwright CLI session at the public URL. Warm the free Render instance, reload current server state, and prepare exactly one demo-owned bus with running enabled, clear weather and EW green. Do not blindly reset a shared visitor's state. Run `video-start` at `1600x1000`, confirm that recording actually started, run the function in `tools/record-demo-v05.js`, then always run `video-stop`. Playwright requires its own FFmpeg installation (`npx playwright install ffmpeg`), separate from the system encoder. Retiming the SRT is necessary on a new recording because live request latency varies.

From the repository root, `./tools/encode-demo-v05.ps1` adds English captions and encodes a new MP4. It refuses to overwrite an existing export. Generated media remains under ignored `output/playwright/`; source captions and recording scripts are tracked deliverables.

The initial recording attempt lacked the Playwright encoder and produced no valid video; its successful interactions were only a rehearsal. During the subsequent idle interval, the public free instance restarted and reset state. The final capture was made only after reloading and rechecking preparation. These operational limits remain in the public-deployment report.

## Public distribution verified

The user explicitly authorized upload to the existing public GitHub repository.

- [Prerelease v0.5.0-rc.1](https://github.com/Cluckin-VV/AI-builderkack-traffic-lab/releases/tag/v0.5.0-rc.1)
- [Download the English-captioned MP4](https://github.com/Cluckin-VV/AI-builderkack-traffic-lab/releases/download/v0.5.0-rc.1/transitlab-v05-demo-final.mp4)
- Tag target: `038a9ef74758652e351ac0e1bd53944e0f2bfc91`, matching the deployed source. Existing tags and main history were not rewritten.
- Anonymous download returned HTTP 200 with 15,637,234 bytes.
- Downloaded and local SHA-256 both: `2669281bcf1ffa45d28120a8836576daba3d67a0ce8be68951eca70b4c9551ec`.
- This link serves an MP4 download; it is not a YouTube/Vimeo embed. Kaggle's acceptance/display of this video host has not yet been checked.

Final Kaggle submission: **not performed**.
