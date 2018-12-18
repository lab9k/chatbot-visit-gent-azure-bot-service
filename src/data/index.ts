import { SparqlApi } from './sparql';
import { RequestType } from './types';

export async function getData(type: RequestType) {
  const api = new SparqlApi('https://stad.gent/sparql');
  switch (type) {
    case RequestType.ATTRACTIONS:
      return await api.getAttractions();
    case RequestType.EVENTS:
      return await api.getEvents();
    default:
      return Promise.reject('Invalid RequestType');
  }
}
export * from './types';
