import axios from 'axios';
import * as fs from 'fs';
import { Dictionary, filter, map, mapValues, pick } from 'lodash';
import * as path from 'path';
import { IRawData } from '../models/rawData';

export class SparqlApi {
  private readonly options = {
    debug: 'on',
    format: 'application/sparql-results+json',
  };
  constructor(private baseUrl: string) {}

  public async getAttractions() {
    const query = fs
      .readFileSync(
        path.join(__dirname, '..', '..', 'queries', 'attractions.rq'),
      )
      .toString();
    const d = await this.query(query);
    return rawParse(d);
  }

  public async getEvents() {
    const query = fs
      .readFileSync(path.join(__dirname, '..', '..', 'queries', 'events.rq'))
      .toString();
    const d = await this.query(query);
    return rawParse(d);
  }

  private async query(query: string): Promise<IRawData> {
    const { data } = await axios.get(this.baseUrl, {
      params: { ...this.options, query },
    });
    return data;
  }
}

const onlyNl = (item: { name: { 'xml:lang': string } }): boolean =>
  item.name['xml:lang'] === 'nl';
const rawParse = (rawData: IRawData): Dictionary<any>[] => {
  const {
    head: { vars: properties },
    results: { bindings: items },
  } = rawData;
  return map(filter(items, onlyNl), (item) => {
    const picked = pick(item, properties);
    return mapValues(picked, (v, key) => {
      const { value } = v;
      if (key.includes('List')) {
        return value.split(', ');
      }
      return value;
    });
  });
};
