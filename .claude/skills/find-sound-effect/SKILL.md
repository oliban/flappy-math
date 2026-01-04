---
name: find-sound-effect
description: Use when the user needs a sound effect for the game, describes a sound they want, or mentions needing audio for an event
---

# Find Sound Effect

## Overview

Search free sound effect sites for matching audio, download 10 options for user to audition, then save the chosen sound to the project.

**Scope**: Finding and downloading sounds only. Does not write playback code.

## Preferences

| Preference | Value |
|------------|-------|
| Format | MP3 |
| Duration | Short clips (under 2s ideally) |
| Options | 10 to audition |
| License | Any free license |
| Location | sounds/ directory |

## Workflow

1. **Understand the need**: Clarify what sound is needed (e.g., "crash into pipe" -> cartoon bonk/thud)

2. **Search**: Use WebSearch to find free sound effect sites with matching sounds
   - Try search queries like: "free [description] sound effect mp3"
   - Good sources: Freesound.org, Pixabay, Zapsplat, Mixkit

3. **Browse results**: Use browser tools to visit promising links and find direct download URLs
   - Look for short clips (under 2 seconds preferred)
   - Check license allows free use

4. **Download options**: Download 10 promising sounds to `sounds/options/<sound-name>/`
   - Name them: `<sound-name>-option-1.mp3`, `<sound-name>-option-2.mp3`, etc.
   - Each sound request gets its own subdirectory (e.g., `options/crash/`, `options/flap/`)
   - Use headless approach (curl/WebFetch) when possible, browser only if needed

5. **Trim silence**: Auto-trim silence from start AND end of each sound before presenting
   - Use: `ffmpeg -i input.mp3 -af "silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB,areverse" output.mp3`

6. **Present to user**: List the downloaded options with descriptions and durations
   - Ask if user wants to open the folder in Finder
   - Ask which one they prefer

7. **Finalize**: Move chosen sound to sounds/ directory with appropriate name

## Common Mistakes

- Downloading very long sound files (prefer under 2s)
- Forgetting to check license
- Not providing enough options to compare
