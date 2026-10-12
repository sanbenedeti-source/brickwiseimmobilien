import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('app/lib/profile-fields.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded={exports:{}};new Function('exports',code)(loaded.exports);
const {readProfileFields,profilePatch}=loaded.exports;
const saved={full_name:'Anna Smith',date_of_birth:'1990-05-23',gender:'female',phone:'+49123456789',country:'Germany',referral_code:'KEEP',phone_verified:true};
function form(fields){const result=new FormData();for(const [k,v] of Object.entries(fields))result.set(k,v);return result;}
test('reopening a populated profile loads all saved values; changing only name preserves the rest',()=>{
 const initial=readProfileFields(saved);
 assert.deepEqual(initial,{first_name:'Anna',last_name:'Smith',date_of_birth:saved.date_of_birth,gender:saved.gender,phone:saved.phone,country:saved.country});
 const patch=profilePatch(initial,form({...initial,first_name:'Anne'}));
 assert.deepEqual(patch,{first_name:'Anne',full_name:'Anne Smith'});
 const persisted={...saved,...patch};
 for(const field of ['date_of_birth','gender','phone','country','referral_code','phone_verified'])assert.equal(persisted[field],saved[field]);
 assert.equal(readProfileFields(persisted).first_name,'Anne');
});
test('unchanged or omitted fields cause no writes, preserving changes from another session',()=>{
 const initial=readProfileFields(saved);
 assert.deepEqual(profilePatch(initial,form(initial)),{});
 assert.deepEqual(profilePatch(initial,new FormData()),{});
 const patch=profilePatch(initial,form({...initial,phone:'+4922222222'}));
 assert.deepEqual(patch,{phone:'+4922222222'});
 assert.equal({...saved,country:'Italy',...patch}.country,'Italy');
});
test('explicit clearing is distinct from omitted fields; unrelated metadata is never accepted',()=>{
 const patch=profilePatch(readProfileFields(saved),form({phone:'',role:'admin',email:'someone@example.invalid',phone_verified:'true'}));
 assert.deepEqual(patch,{phone:''});
});
test('stored separate names and unknown select values survive reopening',()=>{
 const initial=readProfileFields({...saved,first_name:'Mary Jane',last_name:'van Doe',gender:'undisclosed',country:'DE'});
 assert.equal(initial.first_name,'Mary Jane');assert.equal(initial.last_name,'van Doe');
 assert.deepEqual(profilePatch(initial,form(initial)),{});
});
