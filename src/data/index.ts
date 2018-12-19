import { CardFactory } from 'botbuilder';
import { map, sample, sampleSize } from 'lodash';

import { SparqlApi } from './sparql';
import { RequestType } from './types';

export async function getDataCards(type: RequestType) {
  const api = new SparqlApi('https://stad.gent/sparql');
  switch (type) {
    case RequestType.ATTRACTIONS:
      const attractions = await api.getAttractions();
      return map(sampleSize(attractions, 4), (attraction) => {
        return CardFactory.heroCard(
          attraction.name,
          [{ url: sample(attraction.imagesList) }],
          [{ type: 'openUrl', title: 'Open Page', value: attraction.strurl }],
          { subtitle: attraction.description },
        );
      });
    case RequestType.EVENTS:
      const events = await api.getEvents();
      return map(sampleSize(events, 4), (event) => {
        return CardFactory.heroCard(
          event.name,
          [{ url: sample(event.imagesList) }],
          [{ type: 'openUrl', title: 'Open Page', value: event.page }],
          { subtitle: event.description },
        );
      });
    default:
      return Promise.reject('Invalid RequestType');
  }
}
export * from './types';
