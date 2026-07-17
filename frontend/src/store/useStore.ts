"use client";import {create} from "zustand";
export type Message={id:string;role:"user"|"assistant";content:string;values?:{label:string;value:number;zScore?:number}[];chartType?:"bar"|"line"|"pie"|"area"|"scatter"};
type State={rows:Record<string,unknown>[];datasetId:string;messages:Message[];loading:boolean;setDataset:(rows:Record<string,unknown>[],id:string)=>void;add:(message:Message)=>void;setLoading:(loading:boolean)=>void;reset:()=>void};
export const useStore=create<State>(set=>({rows:[],datasetId:"",messages:[],loading:false,setDataset:(rows,datasetId)=>set({rows,datasetId,messages:[]}),add:message=>set(state=>({messages:[...state.messages,message]})),setLoading:loading=>set({loading}),reset:()=>set({rows:[],datasetId:"",messages:[],loading:false})}));
