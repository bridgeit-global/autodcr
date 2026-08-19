import {
  AcDbDatabaseConverterManager,
  AcDbFileType,
} from "@mlightcad/data-model";
import { AcDbLibreDwgConverter } from "@mlightcad/libredwg-converter";

export function registerLibreDwgConverter(parserWorkerUrl: string): void {
  const converter = new AcDbLibreDwgConverter({
    convertByEntityType: false,
    useWorker: true,
    parserWorkerUrl,
  });
  AcDbDatabaseConverterManager.instance.register(AcDbFileType.DWG, converter);
}
