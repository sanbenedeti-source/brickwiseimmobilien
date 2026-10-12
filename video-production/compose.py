"""Build labeled demo screens and composite a downloaded HeyGen presenter.

python video-production/compose.py --preview
python video-production/compose.py --language en --source path/to/presenter.mp4

All UI screens are illustrative reconstructions, not recordings of transactions.
An SRT can provide scene starts through --timings (JSON list of 8 start seconds).
Without verified timings, output is explicitly a review draft.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.tools'))
from PIL import Image, ImageDraw, ImageFont, ImageOps
import imageio_ffmpeg

NAVY = '#17233f'
BLUE = '#2f9bdb'
GRAY = '#758095'
COPY = {
 'en': ['How Brickwise works', 'Register', 'Wallet', 'Properties', 'Buy with wallet', 'Assets', 'Income', 'DEMO • Illustrative interface', 'Available balance', 'Payment instructions', 'Payment reference', 'Funding confirmed — later', 'Demo Apartment', 'Price / share', 'Shares', 'Purchase amount', 'Review and confirm', 'Purchase successful', 'Holdings', 'Rental projection', 'Estimates only • Not guaranteed', 'Not recorded earnings or wallet credits', 'Complete the required registration steps', 'Review property details and risks', 'Projection timeline', 'Model assumptions apply'],
 'de': ['So funktioniert Brickwise', 'Registrieren', 'Wallet', 'Immobilien', 'Mit Wallet kaufen', 'Vermögenswerte', 'Erträge', 'DEMO • Beispielhafte Oberfläche', 'Verfügbares Guthaben', 'Zahlungsanweisungen', 'Verwendungszweck', 'Einzahlung bestätigt — später', 'Demo-Wohnung', 'Preis / Anteil', 'Anteile', 'Kaufbetrag', 'Prüfen und bestätigen', 'Kauf erfolgreich', 'Bestand', 'Mietprognose', 'Nur Schätzungen • Nicht garantiert', 'Keine verbuchten Erträge oder Wallet-Gutschriften', 'Erforderliche Registrierungsschritte abschließen', 'Immobiliendetails und Risiken prüfen', 'Prognoseverlauf', 'Modellannahmen gelten'],
 'fr': ['Comment fonctionne Brickwise', 'Inscription', 'Portefeuille', 'Biens', 'Acheter avec le portefeuille', 'Actifs', 'Revenus', 'DÉMO • Interface illustrative', 'Solde disponible', 'Instructions de paiement', 'Référence du paiement', 'Versement confirmé — plus tard', 'Appartement démo', 'Prix / part', 'Parts', 'Montant de l’achat', 'Vérifier et confirmer', 'Achat réussi', 'Participations', 'Projection locative', 'Estimations • Non garanties', 'Ni gains enregistrés ni crédits au portefeuille', 'Terminez les étapes d’inscription requises', 'Consultez les détails du bien et les risques', 'Évolution prévisionnelle', 'Selon les hypothèses du modèle'],
 'es': ['Cómo funciona Brickwise', 'Registro', 'Cartera', 'Propiedades', 'Comprar con la cartera', 'Activos', 'Ingresos', 'DEMO • Interfaz ilustrativa', 'Saldo disponible', 'Instrucciones de pago', 'Referencia de pago', 'Ingreso confirmado — después', 'Apartamento demo', 'Precio / participación', 'Participaciones', 'Importe de compra', 'Revisar y confirmar', 'Compra realizada', 'Participaciones', 'Proyección de alquiler', 'Estimaciones • No garantizadas', 'Sin ganancias registradas ni abonos a la cartera', 'Completa los pasos de registro necesarios', 'Revisa los detalles del inmueble y los riesgos', 'Evolución prevista', 'Según los supuestos del modelo'],
 'it': ['Come funziona Brickwise', 'Registrazione', 'Wallet', 'Immobili', 'Acquista con il wallet', 'Asset', 'Reddito', 'DEMO • Interfaccia illustrativa', 'Saldo disponibile', 'Istruzioni di pagamento', 'Riferimento del pagamento', 'Versamento confermato — dopo', 'Appartamento demo', 'Prezzo / quota', 'Quote', 'Importo dell’acquisto', 'Controlla e conferma', 'Acquisto completato', 'Partecipazioni', 'Proiezione locativa', 'Stime • Non garantite', 'Nessun guadagno registrato o accredito sul wallet', 'Completa i passaggi di registrazione richiesti', 'Esamina i dettagli dell’immobile e i rischi', 'Andamento previsto', 'Secondo le ipotesi del modello']
}

def font(size=28, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/' + ('arialbd.ttf' if bold else 'arial.ttf'), size)

def screen(lang, step):
    c = COPY[lang]
    im = Image.new('RGB', (1920, 1080), '#f4f6f8')
    d = ImageDraw.Draw(im)
    def txt(x,y,s,size=28,color=NAVY,bold=False):
        d.text((x,y),s,font=font(size,bold),fill=color)
    def box(x,y,w,h,color='white'):
        d.rounded_rectangle((x,y,x+w,y+h),radius=12,fill=color)
    def value(x,y,label,v):
        txt(x,y,label,24,GRAY)
        txt(x,y+46,v,48,NAVY,True)
    d.rectangle((0,0,1920,76),fill=NAVY)
    txt(38,22,'BRICKWISE',29,'white',True)
    txt(970,24,c[7],25,'#bfe7ff')
    d.rectangle((0,76,290,1080),fill='white')
    txt(30,118,'Alex Demo',28,NAVY,True)
    txt(30,162,'alex@example.com',19,GRAY)
    active = [1,2,2,3,4,4,5,6][step]
    for i in range(1,7):
        y=240+(i-1)*83
        if i==active: box(16,y-12,258,65,'#edf6fb')
        label=c[i]
        # Long action labels wrap in the sidebar instead of overflowing.
        words=label.split(); lines=['']
        for word in words:
            candidate=(lines[-1]+' '+word).strip()
            if d.textlength(candidate,font=font(21))>225: lines.append(word)
            else: lines[-1]=candidate
        for j,line in enumerate(lines): txt(32,y+j*25,line,21,BLUE if i==active else GRAY,i==active)
    txt(350,115,c[active],42,NAVY,True)
    txt(350,177,c[0],25,GRAY)
    box(350,240,1070,630)
    if step==0:
        txt(395,285,c[22],29,NAVY,True)
        labels={'en':['Name','Email','Password'],'de':['Name','E-Mail','Passwort'],'fr':['Nom','E-mail','Mot de passe'],'es':['Nombre','Correo electrónico','Contraseña'],'it':['Nome','Email','Password']}[lang]
        for y,label,v in zip([370,490,610],labels,['Alex Demo','alex@example.com','••••••••••••']):
            txt(400,y,label,23,GRAY);box(400,y+36,720,62,'#f4f6f8');txt(420,y+50,v,29)
        box(400,765,450,64,BLUE);txt(425,782,c[1],28,'white',True)
    elif step in (1,2):
        value(400,280,c[8],'€ 0' if step==1 else '€ 1,000')
        txt(400,420,c[9],30,NAVY,True)
        txt(400,485,c[10],24,GRAY);txt(400,530,'DEMO-001',34,NAVY,True)
        if step==2:
            box(400,650,930,100,'#e5f6ee');txt(425,683,c[11],28,'#21734b',True)
        else:
            txt(400,650,'€ 1,000',42,NAVY,True)
            txt(400,720,'DEMO',24,BLUE,True)
    elif step==3:
        photo=Image.open(ROOT.parent/'public/property-1.jpg').convert('RGB')
        im.paste(ImageOps.fit(photo,(470,315)),(390,280))
        txt(900,290,c[12],30,NAVY,True)
        value(900,380,c[13],'€ 250')
        value(900,505,c[14],'2')
        txt(400,660,c[23],28,NAVY,True)
        txt(400,735,'DEMO',24,BLUE,True)
    elif step in (4,5):
        txt(400,290,c[12],34,NAVY,True)
        value(400,375,c[14],'2');value(820,375,c[15],'€ 500')
        value(400,530,c[8],'€ 1,000' if step==4 else '€ 500')
        box(400,730,910,78,BLUE if step==4 else '#e5f6ee')
        txt(425,753,c[16] if step==4 else c[17],29,'white' if step==4 else '#21734b',True)
    elif step==6:
        txt(400,290,c[18],32,NAVY,True)
        txt(400,370,c[12],31)
        value(400,475,c[14],'2');value(820,475,c[15],'€ 500')
        value(400,660,c[8],'€ 500')
    else:
        txt(400,285,c[19],36,NAVY,True)
        txt(400,355,c[24],24,GRAY)
        # A conceptual timeline, deliberately without fabricated return values.
        d.line((430,620,1310,620),fill='#dfe5eb',width=3)
        for i in range(7):
            x=450+i*135
            d.ellipse((x-7,612,x+7,626),fill=BLUE)
            txt(x-8,650,str(i+1),21,GRAY)
        txt(400,460,c[25],29)
        box(385,735,1010,90,'#fff5df')
        txt(410,757,c[20],29,'#8b5a0b',True)
    # Presenter stays in this reserved right-side area, outside all controls.
    box(1470,530,410,360,NAVY)
    txt(1510,560,'BRICKWISE',24,'white',True)
    txt(1530,695,'Kacper',32,'white',True)
    txt(350,930,c[21] if step==7 else c[7],27,NAVY,True)
    txt(350,986,'01   →   02   →   03   →   04   →   05   →   06',25,GRAY)
    return im

def backgrounds(lang):
    folder=ROOT/'frames'/lang;folder.mkdir(parents=True,exist_ok=True)
    paths=[]
    for i in range(8):
        p=folder/f'{i:02}.png';screen(lang,i).save(p);paths.append(p)
    sheet=Image.new('RGB',(1920,540),'white')
    for i,p in enumerate(paths):
        sheet.paste(Image.open(p).resize((480,270)),((i%4)*480,(i//4)*270))
    sheet.save(folder/'contact-sheet.jpg')
    return paths

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--preview',action='store_true')
    parser.add_argument('--language',choices=COPY,default='en')
    parser.add_argument('--source',type=Path)
    parser.add_argument('--timings',type=Path)
    args=parser.parse_args()
    if args.preview:
        for lang in COPY: backgrounds(lang)
        print('Created 40 illustrative screens and 5 contact sheets.');return
    if not args.source or not args.source.is_file(): parser.error('--source must be a downloaded presenter video')
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    probe=subprocess.run([ffmpeg,'-i',str(args.source)],capture_output=True,text=True)
    match=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',probe.stderr)
    if not match: raise RuntimeError('Could not read presenter duration')
    duration=int(match[1])*3600+int(match[2])*60+float(match[3])
    target=min(88,max(60,duration));ratio=target/duration
    if not 0.8<=ratio<=1.2: raise RuntimeError('Narration requires editorial pacing review; refusing excessive speed change')
    starts=json.loads(args.timings.read_text()) if args.timings else [duration*x for x in [0,.16,.29,.35,.49,.60,.66,.75]]
    if len(starts)!=8 or starts[0]!=0 or starts!=sorted(set(starts)) or starts[-1]>=duration: raise ValueError('Expected 8 increasing scene starts beginning at zero')
    paths=backgrounds(args.language)
    playlist=ROOT/'frames'/args.language/'sequence.ffconcat'
    lines=['ffconcat version 1.0']
    for i,p in enumerate(paths):
        end=starts[i+1] if i<7 else duration
        lines.extend([f"file '{p.name}'",f'duration {(end-starts[i])*ratio:.6f}'])
    lines.append(f"file '{paths[-1].name}'")
    playlist.write_text('\n'.join(lines),encoding='utf-8')
    output=ROOT/'output';output.mkdir(exist_ok=True)
    out=output/f'brickwise-how-it-works-{args.language}-review.mp4'
    filters=f'[1:v]setpts={ratio}*(PTS-STARTPTS),scale=410:300:force_original_aspect_ratio=increase,crop=410:300[p];[0:v][p]overlay=1470:590:shortest=1,fps=25,format=yuv420p[v];[1:a]atempo={1/ratio}[a]'
    subprocess.run([ffmpeg,'-y','-f','concat','-safe','0','-i',str(playlist),'-i',str(args.source),'-filter_complex',filters,'-map','[v]','-map','[a]','-t',str(target),'-c:v','libx264','-preset','medium','-crf','19','-c:a','aac','-b:a','192k','-movflags','+faststart',str(out)],check=True)
    print(json.dumps({'output':str(out),'duration':target,'timings_verified':bool(args.timings),'status':'review required'}))

if __name__=='__main__': main()
