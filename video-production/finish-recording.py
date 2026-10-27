"""Composite a real local browser capture with its existing HeyGen presenter."""
from pathlib import Path
import sys,subprocess,json
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'.tools'))
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
lang=sys.argv[1] if len(sys.argv)>1 else 'en'
metadata=json.loads((ROOT/'sources/all-downloads.json').read_text())[lang]
duration=metadata['duration']
capture=ROOT/'output'/('browser' if lang=='en' else 'browser-'+lang)/('walkthrough-'+lang+'.webm')
output=ROOT/'output'/('brickwise-how-it-works-'+lang+'.mp4')
banner_text={'en':'DEMO · 14 days later / 6% annual assumption','de':'DEMO · 14 Tage später / Jahresannahme 6%','fr':'DÉMO · 14 jours plus tard / hypothèse annuelle 6%','es':'DEMO · 14 días después / supuesto anual 6%','it':'DEMO · 14 giorni dopo / ipotesi annua 6%'}
banner=Image.new('RGB',(1172,58),'#fff3cb');ImageDraw.Draw(banner).text((16,18),banner_text[lang],font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17),fill='#17233f')
banner_path=ROOT/'output'/f'time-jump-{lang}.png';banner.save(banner_path)
income_start={'en':47.9,'de':53.3,'fr':48.0,'es':53.3,'it':52.8}[lang]
filters=(f"[0:v][2:v]overlay=284:195:enable='gte(t,{income_start})'[screen];"
         "[screen]setpts=PTS-STARTPTS,fps=25,tpad=stop_mode=clone:stop_duration=3,"
         "drawbox=x=1485:y=560:w=410:h=410:color=0x17233f:t=fill[bg];"
         "[1:v]crop=1080:1080:420:0,scale=390:390,setpts=PTS-STARTPTS[p];"
         "[bg][p]overlay=1495:570,"
         f"subtitles=sources/{lang}.srt:force_style='FontName=Arial,FontSize=12,PrimaryColour=&H00FFFFFF,OutlineColour=&H003F2317,BorderStyle=3,Outline=2,Shadow=0,MarginV=4',"
         "format=yuv420p[v]")
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-i',str(capture),'-i',str(ROOT/'sources'/f'{lang}.mp4'),'-loop','1','-i',str(banner_path),'-filter_complex',filters,'-map','[v]','-map','1:a:0','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-b:a','192k','-movflags','+faststart',str(output)],cwd=ROOT,check=True,stdout=subprocess.DEVNULL,stderr=(ROOT/'output'/f'encode-{lang}.log').open('w'))
print(json.dumps({'file':str(output),'duration':duration,'bytes':output.stat().st_size}))
