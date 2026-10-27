"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, Send, X } from "lucide-react";
import type { Locale } from "../lib/i18n";
import { company } from "../lib/company";

const copy = {
  en: ["Chat with us", "Automatic replies", "Hello! How can I help? Choose a topic or type your question.", "Write a message…", "Send", "Close chat", "Properties", "How to invest", "My account", "Contact", "Explore our property listings. Each property page contains its own details and investment information.", "Start by exploring the available properties and reading the investment details. Our team can help with the next steps.", "Sign in to access your account. If you forgot your password, use the password reset option on the sign-in page.", "For personal assistance or a viewing request, contact our team:", "I could not match your question to an automatic answer. Please choose a topic below or contact our team for help.", "Open page", "Please do not share passwords or payment details."],
  de: ["Chatten Sie mit uns", "Automatische Antworten", "Hallo! Wie kann ich helfen? Wählen Sie ein Thema oder schreiben Sie Ihre Frage.", "Nachricht schreiben…", "Senden", "Chat schließen", "Immobilien", "So investieren Sie", "Mein Konto", "Kontakt", "Entdecken Sie unsere Immobilienangebote. Auf der jeweiligen Objektseite finden Sie Details und Informationen zur Investition.", "Sehen Sie sich die verfügbaren Immobilien und die Investitionsdetails an. Unser Team hilft Ihnen bei den nächsten Schritten.", "Melden Sie sich an, um auf Ihr Konto zuzugreifen. Falls Sie Ihr Passwort vergessen haben, nutzen Sie die Funktion zum Zurücksetzen auf der Anmeldeseite.", "Für persönliche Hilfe oder eine Besichtigungsanfrage erreichen Sie unser Team hier:", "Zu Ihrer Frage habe ich keine passende automatische Antwort. Wählen Sie ein Thema oder kontaktieren Sie unser Team.", "Seite öffnen", "Bitte keine Passwörter oder Zahlungsdaten teilen."],
  fr: ["Discuter avec nous", "Réponses automatiques", "Bonjour ! Comment puis-je vous aider ? Choisissez un sujet ou posez votre question.", "Votre message…", "Envoyer", "Fermer le chat", "Biens immobiliers", "Comment investir", "Mon compte", "Contact", "Découvrez nos biens immobiliers. Chaque fiche présente les détails du bien et les informations sur l’investissement.", "Consultez les biens disponibles et les détails de l’investissement. Notre équipe peut vous accompagner dans les prochaines étapes.", "Connectez-vous pour accéder à votre compte. En cas d’oubli, utilisez la réinitialisation du mot de passe sur la page de connexion.", "Pour une aide personnalisée ou une demande de visite, contactez notre équipe :", "Je n’ai pas trouvé de réponse automatique à votre question. Choisissez un sujet ou contactez notre équipe.", "Ouvrir la page", "Ne partagez pas de mots de passe ni de données de paiement."],
  es: ["Chatea con nosotros", "Respuestas automáticas", "¡Hola! ¿Cómo puedo ayudarte? Elige un tema o escribe tu pregunta.", "Escribe un mensaje…", "Enviar", "Cerrar chat", "Inmuebles", "Cómo invertir", "Mi cuenta", "Contacto", "Explora nuestros inmuebles. Cada ficha contiene los detalles de la propiedad y la información de inversión.", "Consulta los inmuebles disponibles y los detalles de inversión. Nuestro equipo puede ayudarte con los siguientes pasos.", "Inicia sesión para acceder a tu cuenta. Si olvidaste tu contraseña, usa la opción de restablecimiento en la página de acceso.", "Para recibir ayuda o solicitar una visita, contacta con nuestro equipo:", "No he encontrado una respuesta automática para tu pregunta. Elige un tema o contacta con nuestro equipo.", "Abrir página", "No compartas contraseñas ni datos de pago."],
  it: ["Chatta con noi", "Risposte automatiche", "Ciao! Come posso aiutarti? Scegli un argomento o scrivi la tua domanda.", "Scrivi un messaggio…", "Invia", "Chiudi chat", "Immobili", "Come investire", "Il mio account", "Contatti", "Esplora i nostri immobili. Ogni scheda contiene i dettagli della proprietà e le informazioni sull’investimento.", "Consulta gli immobili disponibili e i dettagli dell’investimento. Il nostro team può aiutarti con i prossimi passi.", "Accedi al tuo account. Se hai dimenticato la password, utilizza la funzione di reimpostazione nella pagina di accesso.", "Per assistenza o una richiesta di visita, contatta il nostro team:", "Non ho trovato una risposta automatica alla tua domanda. Scegli un argomento o contatta il nostro team.", "Apri pagina", "Non condividere password o dati di pagamento."],
} satisfies Record<Locale, string[]>;

const topics = [
  { href: "/properties", pattern: /\b(propert\w*|immobil\w*|apartment\w*|wohnung\w*|haus|hauser|biens?|inmueble\w*|casa)\b/ },
  { href: "/real-estate-investing", pattern: /\b(invest\w*|start|begin\w*|anfang\w*|inizi\w*|commenc\w*)\b/ },
  { href: "/sign-in", pattern: /\b(account|konto|login|log\s?in|sign\s?in|password|passwort|compte|cuenta|contrase\w*)\b/ },
  { href: "/contact", pattern: /\b(contact\w*|kontakt\w*|contatt\w*|email|e-mail|phone|telefon\w*|call|visit\w*|besichtig\w*|termin\w*|agent\w*|human|person|mensch|support|hilfe|help)\b/ },
];
const aiCopy = {
  en: ["AI assistant", "Writing a reply…", "AI is temporarily unavailable. Please try again or contact our team.", "Too many messages. Please wait a minute.", "Messages are sent to OpenAI to generate replies. Do not share sensitive information.", "Privacy"],
  de: ["KI-Assistent", "Antwort wird erstellt…", "Die KI ist vorübergehend nicht verfügbar. Bitte versuchen Sie es erneut oder kontaktieren Sie uns.", "Zu viele Nachrichten. Bitte warten Sie eine Minute.", "Nachrichten werden zur Beantwortung an OpenAI gesendet. Bitte keine sensiblen Daten teilen.", "Datenschutz"],
  fr: ["Assistant IA", "Rédaction en cours…", "L’IA est temporairement indisponible. Réessayez ou contactez notre équipe.", "Trop de messages. Patientez une minute.", "Les messages sont envoyés à OpenAI pour générer les réponses. Ne partagez pas de données sensibles.", "Confidentialité"],
  es: ["Asistente IA", "Escribiendo…", "La IA no está disponible temporalmente. Inténtalo de nuevo o contacta con nuestro equipo.", "Demasiados mensajes. Espera un minuto.", "Los mensajes se envían a OpenAI para generar respuestas. No compartas información sensible.", "Privacidad"],
  it: ["Assistente IA", "Risposta in corso…", "L’IA non è momentaneamente disponibile. Riprova o contatta il nostro team.", "Troppi messaggi. Attendi un minuto.", "I messaggi vengono inviati a OpenAI per generare risposte. Non condividere dati sensibili.", "Privacy"],
} satisfies Record<Locale, string[]>;
type Message = { text: string; user?: boolean; href?: string; local?: boolean };

function ChatPanel({ locale }: { locale: Locale }) {
  const text = copy[locale];
  const ai = aiCopy[locale];
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ text: text[2], local: true }]);
  const input = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => () => controller.current?.abort(), []);

  function close() { setOpen(false); launcher.current?.focus(); }
  async function send(value: string, selected?: number) {
    const question = value.trim().slice(0, 500);
    if (!question || busy.current) return;
    const conversation: Message[] = [...messages, { text: question, user: true }];
    setMessages(conversation.slice(-60));
    setDraft("");
    busy.current = true;
    setPending(true);
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 35000);
    // Stay below the server limits (assistant turns ≤ 1,500 characters, body ≤ 24 KB): drop the oldest turns first.
    const history = conversation.filter((message) => !message.local).slice(-12).map((message) => ({ role: message.user ? "user" : "assistant", content: message.user ? message.text : message.text.slice(0, 1500) }));
    while (history.length > 1 && new TextEncoder().encode(JSON.stringify(history)).length > 18000) history.shift();
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: abort.signal,
        body: JSON.stringify({ locale, messages: history }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? "rate_limited" : "unavailable");
      const data = await response.json();
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("unavailable");
      setMessages((previous) => [...previous, { text: data.reply, href: selected === undefined ? undefined : topics[selected].href }].slice(-60));
    } catch (error) {
      const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const topic = selected ?? topics.findIndex((item) => item.pattern.test(normalized));
      const fallback = topic >= 0 ? text[10 + topic] : "";
      const contact = topic === 3 ? `\n${company.email}\n${company.phoneDisplay}` : "";
      const notice = error instanceof Error && error.message === "rate_limited" ? ai[3] : ai[2];
      setMessages((previous) => [...previous, { text: `${notice}${fallback ? `\n\n${fallback}${contact}` : ""}`, href: topic >= 0 ? topics[topic].href : "/contact", local: true }].slice(-60));
    } finally {
      clearTimeout(timer);
      busy.current = false;
      setPending(false);
    }
  }

  return <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[80] sm:right-6">
    {open && <section id="brickwise-chat" role="dialog" aria-labelledby="brickwise-chat-title" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }} className="mb-3 flex h-[min(520px,calc(100dvh-10rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <header className="flex items-center gap-3 bg-ink p-4 text-white">
        <MessageCircle size={24} aria-hidden="true" />
        <div className="flex-1"><h2 id="brickwise-chat-title" className="font-bold">Brickwise Chat</h2><p className="mt-0.5 text-xs text-slate-200">{ai[0]}</p></div>
        <button type="button" onClick={close} aria-label={text[5]} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"><X size={20} /></button>
      </header>
      <div ref={log} role="log" aria-live="polite" aria-relevant="additions" aria-label={text[0]} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.map((message, index) => <div key={index} className={`w-fit max-w-[90%] whitespace-pre-line break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.user ? "ml-auto bg-brand text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
          {message.text}
          {message.href && <a href={message.href} className="mt-2 block font-semibold text-brand underline underline-offset-4">{text[15]} →</a>}
        </div>)}
      </div>
      {pending && <p role="status" className="px-4 py-2 text-xs text-slate-500">{ai[1]}</p>}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">{topics.map((topic, index) => <button key={topic.href} type="button" disabled={pending} onClick={() => send(text[6 + index], index)} className="min-h-11 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-brand hover:bg-sky-50">{text[6 + index]}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); send(draft); }} className="flex gap-2 px-4 pb-2">
        <input ref={input} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} aria-label={text[3]} placeholder={text[3]} className="min-w-0 flex-1 rounded-xl border border-line-strong px-3 py-3 text-base text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-sky-100" />
        <button type="submit" disabled={pending || !draft.trim()} aria-label={text[4]} className="rounded-xl bg-brand px-3 text-white hover:bg-ink disabled:opacity-40"><Send size={20} /></button>
      </form>
      <p className="px-4 pb-3 text-[11px] text-slate-500">{ai[4]} <a href="/privacy" className="underline">{ai[5]}</a></p>
    </section>}
    <button ref={launcher} type="button" aria-expanded={open} aria-controls="brickwise-chat" aria-label={open ? text[5] : text[0]} onClick={() => open ? close() : setOpen(true)} title={open ? text[5] : text[0]} className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white sm:h-14 sm:w-14 shadow-[0_10px_25px_rgba(20,33,61,0.25)] ring-4 ring-white transition hover:scale-105 hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:scale-100">
      {open ? <X size={24} aria-hidden="true" /> : <MessageCircle size={26} aria-hidden="true" />}
    </button>
  </div>;
}

export default function WebsiteChat({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  if (["/admin", "/dashboard", "/authentication", "/funding", "/settings", "/join", "/sign-in", "/forgot-password"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;
  return <ChatPanel key={locale} locale={locale} />;
}
