// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
  ActivityTypes,
  CardFactory,
  ConversationState,
  MessageFactory,
  StatePropertyAccessor,
  TurnContext,
  UserState,
} from 'botbuilder';
import {
  DialogContext,
  DialogSet,
  TextPrompt,
  ConfirmPrompt,
  WaterfallDialog,
  WaterfallStepContext,
} from 'botbuilder-dialogs';
import { getDataCards, RequestType } from './data';

import { sample } from 'lodash';

// Turn counter property
const OTHER_DATA_PROMPT = 'other_data_prompt';
const DIALOG_STATE_PROPERTY = 'dialog_state_prop';
const WANTS_INFO_PROPERTY = 'wants_info';
const WHAT_DATA = 'what_data';
const RESET_DIALOG = 'reset_dialog';

export class VisitBot {
  private readonly conversationState: ConversationState;
  private readonly dialogState: StatePropertyAccessor<any>;
  private readonly dialogs: DialogSet;
  private readonly userState: UserState;
  private readonly wantsInfo: StatePropertyAccessor<boolean>;
  /**
   *
   * @param {ConversationState} conversation state object
   */
  constructor(conversationState: ConversationState, userState: UserState) {
    // Create a new state accessor property.
    // See https://aka.ms/about-bot-state-accessors to
    // learn more about the bot state and state accessors.
    this.conversationState = conversationState;
    this.userState = userState;

    this.dialogState = this.conversationState.createProperty(
      DIALOG_STATE_PROPERTY,
    );
    this.wantsInfo = this.userState.createProperty(WANTS_INFO_PROPERTY);

    this.dialogs = new DialogSet(this.dialogState);

    this.dialogs.add(new ConfirmPrompt(OTHER_DATA_PROMPT));

    this.dialogs.add(
      new WaterfallDialog(WHAT_DATA, [
        this.askWhatToFetch.bind(this),
        this.displayResults.bind(this),
        this.handlePrompt.bind(this),
      ]),
    );

    this.dialogs.add(
      new WaterfallDialog(RESET_DIALOG, [this.resetUser.bind(this)]),
    );
  }

  /**
   * Use onTurn to handle an incoming activity,
   * received from a user, process it, and reply as needed
   *
   * @param {TurnContext} context on turn context object.
   */
  public async onTurn(turnContext: TurnContext) {
    switch (turnContext.activity.type) {
      case ActivityTypes.Message:
        const dc = await this.dialogs.createContext(turnContext);

        if (dc.context.activity.text === 'Reset') {
          return await dc.beginDialog(RESET_DIALOG);
        }
        // ? continue the multistep dialog that's already begun
        // ? won't do anything if there is no running dialog
        await dc.continueDialog();

        // ? Begin main dialog if no outstanding dialogs/ no one responded.
        if (!dc.context.responded) {
          const getInfo = await this.wantsInfo.get(dc.context, true);
          if (getInfo) {
            await dc.beginDialog(WHAT_DATA);
          } else {
            // ask if he wants info anyway
            await dc.context.sendActivity(
              'Alright, i won\'t bother you until you send me another message.',
            );
            await this.wantsInfo.set(dc.context, true);
          }
        }
        break;
      case ActivityTypes.ConversationUpdate:
        await this.welcomeUser(turnContext);
        break;
      default:
        break;
    }
    // Save changes to the user name.
    await this.userState.saveChanges(turnContext);

    // End this turn by saving changes to the conversation state.
    await this.conversationState.saveChanges(turnContext);
  }

  private async askWhatToFetch(step: WaterfallStepContext) {
    const reply = MessageFactory.suggestedActions(
      [RequestType.EVENTS, RequestType.ATTRACTIONS],
      'What would you like to see?',
    );
    await step.context.sendActivity(reply);
  }

  private async displayResults(step: WaterfallStepContext) {
    let data = [];
    try {
      data = await getDataCards(step.result);
    } catch (error) {
      await step.context.sendActivity('Please click one of the buttons.');
      return await step.replaceDialog(WHAT_DATA);
    }

    await step.context.sendActivity({
      attachmentLayout: 'carousel',
      attachments: [...data],
    });
    await step.prompt(
      OTHER_DATA_PROMPT,
      `Would you like to see something else?`,
    );
    // await step.endDialog();
  }

  private async handlePrompt(step: WaterfallStepContext) {
    const reply = step.result;
    this.wantsInfo.set(step.context, reply);
    await step.endDialog();
  }

  private async welcomeUser(turnContext: TurnContext) {
    // Do we have any new members added to the conversation?
    if (turnContext.activity.membersAdded.length !== 0) {
      // Iterate over all new members added to the conversation
      for (const idx in turnContext.activity.membersAdded) {
        // Greet anyone that was not the target (recipient) of this message.
        // Since the bot is the recipient for events from the channel,
        // context.activity.membersAdded === context.activity.recipient.Id indicates the
        // bot was added to the conversation, and the opposite indicates this is a user.
        if (
          turnContext.activity.membersAdded[idx].id !==
          turnContext.activity.recipient.id
        ) {
          // Send a "this is what the bot does" message to this user.
          await turnContext.sendActivity(
            'I am a bot that displays the events and attractions in Ghent.' +
              ' Data is coming from https://visit.gent.be/nl',
          );
        }
      }
    }
  }

  private async resetUser(step: WaterfallStepContext) {
    await this.userState.clear(step.context);
    await this.conversationState.clear(step.context);
    await step.context.sendActivity('Conversation Reset');
    await step.cancelAllDialogs();
    await step.endDialog();

    await this.userState.saveChanges(step.context);
    await this.conversationState.saveChanges(step.context);
  }
}
