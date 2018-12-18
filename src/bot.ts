// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
  ActivityTypes,
  ConversationState,
  StatePropertyAccessor,
  TurnContext,
  UserState,
} from 'botbuilder';
import {
  DialogContext,
  DialogSet,
  TextPrompt,
  WaterfallDialog,
  WaterfallStepContext,
} from 'botbuilder-dialogs';
import { getData, RequestType } from './data';

import { sample } from 'lodash';

// Turn counter property
const USER_NAME_PROP = 'user_name_prop';
const NAME_PROMPT = 'name_prompt';
const WHO_ARE_YOU = 'who_are_you';
const DIALOG_STATE_PROPERTY = 'dialog_state_prop';
const HELLO_USER = 'hello_user';

export class EchoBot {
  private readonly conversationState: ConversationState;
  private readonly userState: UserState;
  private readonly dialogState: StatePropertyAccessor<any>;
  private readonly dialogs: DialogSet;
  private readonly userName: StatePropertyAccessor<any>;
  /**
   *
   * @param {ConversationState} conversation state object
   */
  constructor(conversationState: ConversationState, userState: UserState) {
    // Create a new state accessor property.
    // See https://aka.ms/about-bot-state-accessors to learn more about the bot state and state accessors.
    this.conversationState = conversationState;
    this.userState = userState;

    this.dialogState = this.conversationState.createProperty(
      DIALOG_STATE_PROPERTY,
    );
    this.userName = this.userState.createProperty(USER_NAME_PROP);

    this.dialogs = new DialogSet(this.dialogState);

    this.dialogs.add(new TextPrompt(NAME_PROMPT));
    this.dialogs.add(
      new WaterfallDialog(WHO_ARE_YOU, [
        this.askForName.bind(this),
        this.collectAndDisplayName.bind(this),
      ]),
    );

    this.dialogs.add(
      new WaterfallDialog(HELLO_USER, [this.displayName.bind(this)]),
    );
  }

  /**
   * Use onTurn to handle an incoming activity, received from a user, process it, and reply as needed
   *
   * @param {TurnContext} context on turn context object.
   */
  public async onTurn(turnContext: TurnContext) {
    if (turnContext.activity.type === ActivityTypes.Message) {
      const dc = await this.dialogs.createContext(turnContext);

      if (!turnContext.responded) {
        await dc.continueDialog();
      }

      if (!turnContext.responded) {
        const userName = await this.userName.get(dc.context, null);
        if (userName) {
          await dc.beginDialog(HELLO_USER);
        } else {
          await dc.beginDialog(WHO_ARE_YOU);
        }
      }
    } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate) {
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
              'I am a bot that demonstrates the TextPrompt class to collect your name,' +
                ' store it in UserState, and display it. Say anything to continue.',
            );
          }
        }
      }
    }
    // Save changes to the user name.
    await this.userState.saveChanges(turnContext);

    // End this turn by saving changes to the conversation state.
    await this.conversationState.saveChanges(turnContext);
  }

  private async askForName(dc: DialogContext) {
    await dc.prompt(NAME_PROMPT, 'What is your name, human?');
  }

  private async collectAndDisplayName(step: WaterfallStepContext) {
    await this.userName.set(step.context, step.result);
    await step.context.sendActivity(`Got it. You are ${step.result}.`);
    await step.endDialog();
  }

  private async displayName(step: WaterfallStepContext) {
    const data = await getData(RequestType.ATTRACTIONS);
    const toSend = sample(data);
    // const userName = await this.userName.get(step.context, null);
    await step.context.sendActivity(`Your name is ${toSend.name}.`);
    await step.endDialog();
  }
}
