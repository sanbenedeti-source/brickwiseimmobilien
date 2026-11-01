"use client";

import Link from "next/link";
import { trackConversion } from "../lib/marketing";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Gift, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useId, useState } from "react";
import { useLocale } from "../components/LocaleProvider";
import { createTranslator } from "../lib/translate";

export type JoinCopy = {
  title:string; intro:string; steps:[string,string,string]; detailsTitle:string; detailsIntro:string; accountTitle:string; accountIntro:string; confirmTitle:string; confirmIntro:string;
  fullName:string; fullNamePlaceholder:string; referral:string; optional:string; referralPlaceholder:string; email:string; emailPlaceholder:string; password:string; passwordPlaceholder:string;
  strength:string; weak:string; fair:string; good:string; strong:string; agreePrefix:string; terms:string; and:string; privacy:string; next:string; back:string;
  registrationError:string; alreadyRegistered:string; connectionError:string; technicalDetails:string; waiting:string; createAccount:string; already:string; signIn:string;
  nameError:string; emailError:string; passwordError:string; termsError:string;
};

// Same-site destinations the registration route may send a newly signed-in account to.
const signedInDestination=/^\/(?:dashboard|admin|properties\/[a-z0-9-]{1,120})$/;

export default function JoinForm({copy,next=""}:{copy:JoinCopy;next?:string}) {
  const t = createTranslator(useLocale());
  const [step,setStep]=useState(1), [email,setEmail]=useState(""), [password,setPassword]=useState(""), [fullName,setFullName]=useState(""), [referralCode,setReferralCode]=useState("");
  const [showPassword,setShowPassword]=useState(false), [accepted,setAccepted]=useState(false), [loading,setLoading]=useState(false);
  const [message,setMessage]=useState(""), [technicalDetails,setTechnicalDetails]=useState("");
  const normalizedEmail=email.trim().toLowerCase();
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const passwordScore=[password.length>=8,/[A-Z]/.test(password),/[a-z]/.test(password),/\d|[^A-Za-z]/.test(password)].filter(Boolean).length;
  const strength=[copy.weak,copy.weak,copy.fair,copy.good,copy.strong][passwordScore];

  function advance(){
    setMessage("");
    if(step===1&&fullName.trim().length<2)return setMessage(copy.nameError);
    if(step===2&&!validEmail)return setMessage(copy.emailError);
    if(step===2&&password.length<8)return setMessage(copy.passwordError);
    setStep((value)=>Math.min(3,value+1));
  }

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(step<3)return advance();
    if(!accepted)return setMessage(copy.termsError);
    setLoading(true);setMessage("");setTechnicalDetails("");
    let navigating=false;
    try{
      const response=await fetch("/interface/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({full_name:fullName.trim(),email:normalizedEmail,password,referral_code:referralCode.trim(),next})});
      const data=await response.json().catch(()=>({})) as {error?:string;technicalDetails?:string;alreadyRegistered?:boolean;signedIn?:boolean;redirectTo?:string;confirmationRequired?:boolean};
      if(!response.ok){setMessage(data.error||copy.registrationError);setTechnicalDetails(data.technicalDetails||"");return;}
      if(data.alreadyRegistered){setMessage(copy.alreadyRegistered);return;}
      trackConversion("CompleteRegistration");
      // Signed in by the registration: continue straight into the client area. Otherwise the
      // sign-in page explains the next step (activation still required by Supabase, or sign in).
      const destination=data.signedIn?(typeof data.redirectTo==="string"&&signedInDestination.test(data.redirectTo)?data.redirectTo:"/dashboard")
        :`/sign-in?${data.confirmationRequired?"registered":"created"}=1&email=${encodeURIComponent(normalizedEmail)}${next?`&next=${encodeURIComponent(next)}`:""}`;
      navigating=true;
      // A full load, not client navigation: registration set the auth cookies through a route
      // handler, so the session-dependent root shell must be rendered again.
      window.location.assign(destination);
    }catch{setMessage(copy.connectionError)}finally{if(!navigating)setLoading(false)}
  }

  return <main className="min-h-screen bg-canvas px-5 pb-20 pt-28 text-ink sm:pt-32">
    <section className="mx-auto min-w-0 w-full max-w-[620px] overflow-hidden">
      <header className="text-center"><h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{copy.title}</h1><p className="mt-3 text-muted">{copy.intro}</p></header>
      <Progress step={step} labels={copy.steps}/>
      <div className="mt-10 text-center"><h2 className="text-2xl font-bold">{step===1?copy.detailsTitle:step===2?copy.accountTitle:copy.confirmTitle}</h2><p className="mt-2 text-muted">{step===1?copy.detailsIntro:step===2?copy.accountIntro:copy.confirmIntro}</p></div>
      <form onSubmit={submit} className="mt-8" noValidate>
        {step===1&&<div className="space-y-5"><Field icon={<UserRound size={19}/>} label={copy.fullName} value={fullName} change={setFullName} placeholder={copy.fullNamePlaceholder} autoComplete="name"/><Field icon={<Gift size={19} className="text-brand"/>} label={<>{copy.referral} <span className="font-normal text-muted">({copy.optional})</span></>} value={referralCode} change={setReferralCode} placeholder={copy.referralPlaceholder} required={false}/></div>}
        {step===2&&<div className="space-y-5"><Field icon={<Mail size={19}/>} label={copy.email} value={email} change={setEmail} placeholder={copy.emailPlaceholder} type="email" autoComplete="email"/><div><label htmlFor="join-password" className="text-sm font-bold">{copy.password}</label><div className="mt-2 flex min-h-14 items-center rounded-2xl border border-line-strong bg-white px-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft"><LockKeyhole size={19} className="shrink-0 text-muted"/><input id="join-password" type={showPassword?"text":"password"} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder={copy.passwordPlaceholder} autoComplete="new-password" className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none"/><button type="button" onClick={()=>setShowPassword((v)=>!v)} className="p-2 text-muted" aria-pressed={showPassword} aria-label={t("Toggle password visibility")}>{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div><div className="mt-3 grid grid-cols-4 gap-1.5">{[1,2,3,4].map((n)=><span key={n} className={`h-1 rounded-full ${passwordScore>=n?"bg-brand":"bg-line"}`}/>)}</div><p className="mt-2 text-xs text-muted">{copy.strength}: <strong className="text-brand">{strength}</strong></p></div></div>}
        {step===3&&<div className="space-y-5"><div className="overflow-hidden rounded-3xl border border-line bg-white px-5"><Review label={copy.fullName} value={fullName.trim()}/><Review label={copy.email} value={normalizedEmail}/><Review label={copy.password} value={"•".repeat(Math.min(password.length,12))} last/></div><label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-5 text-sm leading-6"><input type="checkbox" checked={accepted} onChange={(e)=>setAccepted(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand"/><span>{copy.agreePrefix} <Link href="/terms" target="_blank" className="font-bold text-brand underline">{copy.terms}</Link> {copy.and}{/[’']$/.test(copy.and) ? "" : " "}<Link href="/privacy" target="_blank" className="font-bold text-brand underline">{copy.privacy}</Link>.</span></label></div>}
        {message&&<div role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700"><p>{message}</p>{technicalDetails&&<p className="mt-2 break-words">{copy.technicalDetails}: {technicalDetails}</p>}</div>}
        <div className={`mt-6 grid gap-3 ${step>1?"grid-cols-2":"grid-cols-1"}`}>{step>1&&<button type="button" onClick={()=>{setMessage("");setStep((v)=>v-1)}} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-line bg-white font-bold"><ArrowLeft size={18}/>{copy.back}</button>}<button type="submit" disabled={loading||(step===3&&!accepted)} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand px-5 font-bold text-white shadow-[0_12px_30px_rgba(22,103,168,.18)] hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-brand-light">{loading?copy.waiting:step===3?copy.createAccount:copy.next}{step<3&&<ArrowRight size={18}/>}</button></div>
      </form>
      <p className="mt-7 text-center text-muted">{copy.already} <Link href={next?`/sign-in?next=${encodeURIComponent(next)}`:"/sign-in"} className="font-bold text-brand">{copy.signIn}</Link></p>
    </section>
  </main>;
}

function Progress({step,labels}:{step:number;labels:[string,string,string]}){return <div className="mt-9 grid grid-cols-3"><div className="col-span-3 mx-[16.66%] mt-5 h-0.5 bg-line"><div className="h-full bg-brand transition-all" style={{width:`${((step-1)/2)*100}%`}}/></div>{labels.map((label,index)=>{const n=index+1,done=n<step,active=n===step;return <div key={label} className="-mt-5 flex flex-col items-center"><span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm ${done?"border-brand bg-brand text-white":active?"border-brand bg-canvas text-brand":"border-canvas bg-canvas text-muted"}`}>{done?<Check size={19}/>:n}</span><span className="mt-2 text-xs font-medium">{label}</span></div>})}</div>}
function Field({icon,label,value,change,placeholder,type="text",required=true,autoComplete}:{icon:React.ReactNode;label:React.ReactNode;value:string;change:(v:string)=>void;placeholder:string;type?:string;required?:boolean;autoComplete?:string}){const id=useId();return <div className="min-w-0 max-w-full"><label htmlFor={id} className="text-sm font-bold">{label}</label><div className="mt-2 flex min-h-14 w-full min-w-0 max-w-full items-center rounded-2xl border border-line-strong bg-white px-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-soft"><span className="shrink-0 text-muted">{icon}</span><input id={id} type={type} required={required} value={value} onChange={(e)=>change(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none"/></div></div>}
function Review({label,value,last=false}:{label:string;value:string;last?:boolean}){return <div className={`flex items-center justify-between gap-5 py-4 ${last?"":"border-b border-canvas"}`}><span className="text-sm text-muted">{label}</span><strong className="break-all text-right text-sm">{value}</strong></div>}
