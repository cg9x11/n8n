import type { IExecuteFunctions, IDataObject, INodeExecutionData } from 'n8n-workflow';
import * as sheet from './sheet/Sheet.resource';
import * as spreadsheet from './spreadsheet/SpreadSheet.resource';
import { GoogleSheet } from '../helpers/GoogleSheet';
import { getSpreadsheetId } from '../helpers/GoogleSheets.utils';
import type { GoogleSheets, ResourceLocator } from '../helpers/GoogleSheets.types';

export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	let operationResult: INodeExecutionData[] = [];

	try {
		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		const googleSheets = {
			resource,
			operation,
		} as GoogleSheets;

		let results: INodeExecutionData[] | undefined;
		if (googleSheets.resource === 'sheet') {
			const { mode, value } = this.getNodeParameter('documentId', 0) as IDataObject;
			const spreadsheetId = getSpreadsheetId(
				this.getNode(),
				mode as ResourceLocator,
				value as string,
			);

			const googleSheet = new GoogleSheet(spreadsheetId, this);

			let sheetId = '';
			if (operation !== 'create') {
				sheetId = this.getNodeParameter('sheetName', 0, undefined, {
					extractValue: true,
				}) as string;
			}

			if (sheetId === 'gid=0') {
				sheetId = '0';
			}

			let sheetName = '';
			switch (operation) {
				case 'create':
					sheetName = spreadsheetId;
					break;
				case 'delete':
					sheetName = sheetId;
					break;
				case 'remove':
					sheetName = `${spreadsheetId}||${sheetId}`;
					break;
				default:
					sheetName = await googleSheet.spreadsheetGetSheetNameById(sheetId);
			}

			results = await sheet[googleSheets.operation].execute.call(
				this,
				googleSheet,
				sheetName,
				sheetId,
			);
		} else if (googleSheets.resource === 'spreadsheet') {
			results = await spreadsheet[googleSheets.operation].execute.call(this);
		}
		if (results?.length) {
			operationResult = operationResult.concat(results);
		}
	} catch (err) {
		if (this.continueOnFail()) {
			operationResult.push({ json: this.getInputData(0)[0].json, error: err });
		} else {
			if (
				err.message &&
				(err.message.toLowerCase().includes('bad request') ||
					err.message.toLowerCase().includes('uknown error')) &&
				err.description
			) {
				err.message = err.description;
				err.description = undefined;
			}
			throw err;
		}
	}

	return [operationResult];
}
