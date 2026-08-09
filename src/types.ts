export type ComponentCategory='motherboard'|'gpu'|'memory'|'storage'|'cpu_cooler'|'power_supply'|'case_fan'|'unknown';
export type Box={x:number;y:number;width:number;height:number};
export type Point={x:number;y:number};
export interface Detection{id:string;category:ComponentCategory;confidence:number;boundingBox:Box;outline?:Point[];visibleText:string[];observations:string[];manufacturerCandidates:string[];productCandidates:{productId:string;score:number;evidence:string[]}[];needsConfirmation:boolean;requestedPhoto?:string}
export interface AnalysisResult{imageId:string;imageQuality:{usable:boolean;issues:('blur'|'dark'|'glare'|'occluded')[]};detections:Detection[];warnings:string[]}
export interface VisionAnalysisService{analyze(image:File):Promise<AnalysisResult>}
