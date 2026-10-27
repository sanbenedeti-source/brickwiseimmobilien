"use client";

import { useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { howItWorksCopy } from "../how-it-works/copy";

const languages = { en: "English", de: "Deutsch", fr: "Français", es: "Español", it: "Italiano" };

export default function HowItWorksVideo({ locale }: { locale: Locale }) {
  return <VideoPlayer key={locale} locale={locale} />;
}

const playbackCopy = {
  en: ["Play video", "Pause video", "Open video", "Unable to play here. Please open the video directly."],
  de: ["Video abspielen", "Video pausieren", "Video öffnen", "Wiedergabe nicht möglich. Bitte öffnen Sie das Video direkt."],
  fr: ["Lire la vidéo", "Mettre en pause", "Ouvrir la vidéo", "Lecture impossible ici. Veuillez ouvrir la vidéo directement."],
  es: ["Reproducir vídeo", "Pausar vídeo", "Abrir vídeo", "No se puede reproducir aquí. Abre el vídeo directamente."],
  it: ["Riproduci video", "Pausa video", "Apri video", "Riproduzione non disponibile. Apri il video direttamente."],
};

function VideoPlayer({ locale }: { locale: Locale }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const labels = playbackCopy[locale];
  const copy = howItWorksCopy[locale];
  const source = `/videos/how-it-works/brickwise-how-it-works-${locale}.mp4`;
  async function togglePlayback() {
    const player = video.current;
    if (!player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    setFailed(false);
    try {
      await player.play();
    } catch {
      setFailed(true);
    }
  }
  return <div>
    <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">{copy.title}</h2>
    <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">{copy.intro}</p>
    <video ref={video} src={source} controls playsInline preload="metadata" onPlay={() => { setPlaying(true); setFailed(false); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setFailed(true); }} width={1920} height={1080} poster={`/videos/how-it-works/poster-${locale}.jpg`} aria-label={copy.title} className="mt-8 aspect-video w-full rounded-2xl bg-ink shadow-xl">
      <track kind="captions" src={`/videos/how-it-works/captions-${locale}.vtt`} srcLang={locale} label={languages[locale]} />
      <a href={source}>{copy.download}</a>
    </video>
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <button type="button" onClick={togglePlayback} className="min-h-12 rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-strong">
        {playing ? labels[1] : labels[0]}
      </button>
      <a href={source} className="inline-flex min-h-12 items-center underline underline-offset-4">{labels[2]}</a>
    </div>
    {failed && <p role="alert" className="mt-3 text-sm text-muted">{labels[3]}</p>}
    <p className="mt-6 max-w-4xl text-sm leading-7 text-muted">{copy.note}</p>
  </div>;
}
