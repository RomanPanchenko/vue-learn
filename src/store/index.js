import Vue from 'vue'
import Vuex, { Store } from 'vuex'
import config from '../config'
import plugins from './plugins'
import * as modules from './modules'
import { isMessageShouldBeShown } from '../helpers/messages'
import _orderby from 'lodash.orderby'
import _get from 'lodash.get'

import { enums, client } from 'chat-common'
import differenceInMilliseconds from 'date-fns/difference_in_milliseconds'

Vue.use(Vuex);
Vue.use(client.Storage('local'));
Vue.use(client.Storage('session'));

export default new Store({
  plugins,
  modules,
  state: {
    profile: {},
    engagement: {},
    isChatOpened: Vue.$localStorage.getChatOpenedFlag(),
    isInFullscreen: Vue.$sessionStorage.getFullscreenState(),
    showPersonalizationForm: Vue.$localStorage.getDisplayPersonalizationFormFlag(),
    isCustomerPersonalized: Vue.$localStorage.getCustomerPersonalizedFlag(),
    isThankYouMessageVisible: false,
    shouldDisplayIdentificationThankYouMessage: false,
    messages: [],
    meta: {},
    unreadMessagesCount: 0,
    greetingMessage: '',
    typingUser: null,
    fileUploadConfig: {
      errorMessage: '',
      url: `${config.base_host}/api/v1/uploads`,
    },
  },
  getters: {
    lastMessage({ messages, engagement }) {
      let lastMessage = messages
        .filter(isMessageShouldBeShown)
        .pop();

      if (!lastMessage) {
        return null;
      }

      const isSubmitTicketMessage = lastMessage.posted_by === 0 &&
        lastMessage.message_type === enums.MESSAGE_TYPE.BOT;

      const isMessageFromAgent = _get(lastMessage, 'from.id') === _get(engagement, 'agent.id');

      if (isSubmitTicketMessage || isMessageFromAgent) {
        return lastMessage
      } else {
        return null;
      }
    },
    hasMessage: ({ messages }) => (message) => {
      return messages.find(m => m.id === message.id || m.uid === message.uid)
    },
    isAllMessagesLoaded: ({ meta }) => {
      return meta.currentPage >= meta.pageCount
    },
  },
  actions: {
    closeChat({ commit, state }) {
      if(!state.engagement.isClosedByAgent) {
          this.$socket.emit(enums.EVENT.SITE_CUSTOMER_CLOSE_ENGAGEMENT);
      }

      commit('closeChat');
      this.commit('resetEngagement');
      commit('SOCKET_UPDATE_ENGAGEMENT', {});
    },
    updateMessageViewedTime({ state }) {
      this.$socket.emit(enums.EVENT.UPDATE_MESSAGES_VIEWED_TIME, {
        case_id: state.engagement.id,
        user_id: state.profile.id,
        is_agent: false,
        viewed_at: (new Date()).toISOString(),
      });
    },
    sendMessage({ state }, message) {
      const case_id = state.engagement.isClosedByAgent || state.engagement.isClosedWithTimedOut
        ? null
        : message.case_id

      this.$socket.emit(enums.EVENT.NEW_MESSAGE, Object.assign(message, {
        message_type: enums.MESSAGE_TYPE.MESSAGE,
        posted_at: new Date().toISOString(),
        case_id,
      }))
    },
    pullMessages({ state, getters }) {
      const { meta, engagement } = state
      const { isAllMessagesLoaded } = getters;

      if (isAllMessagesLoaded) {
        return
      }

      const currentPage = meta.currentPage || 1

      this.$socket.emit(enums.EVENT.MESSAGES, {
        page: currentPage + 1
      })
    },
    startTyping() {
      this.$socket.emit(enums.EVENT.USER_IS_TYPING)
    },
    socket_messages({ state, commit, getters, dispatch }, data = {}) {
      const { items = [], meta } = data
      const newData = items.filter(item => !getters.hasMessage(item));

      const messages = newData
        .filter(item => item.message_type !== enums.MESSAGE_TYPE.SURVEY || item.survey && item.survey.is_sent_by_agent)
        .concat(state.messages);

      commit('updateMessages', _orderby(messages, ['posted_at', 'id']))
      commit('updateMeta', meta)
    },
  },
  mutations: {
    setFileUploadErrorMessage(state, data) {
      state.fileUploadConfig.errorMessage = data.errorMessage;
    },
    resetEngagement(state) {
      state.engagement = {};
      state.messages = [];
    },
    switchChatVisibility(state) {
      state.isChatOpened = !state.isChatOpened;
      if (state.isChatOpened) {
        this.commit('resetUnreadMessagesCount');
        state.isThankYouMessageVisible = false;
      }
    },
    incrementUnreadMessagesCount(state) {
      state.unreadMessagesCount++;
    },
    resetUnreadMessagesCount(state) {
      state.unreadMessagesCount = 0;
      this.dispatch('updateMessageViewedTime');
    },
    closeChat(state) {
      const HIDE_THANK_YOU_MESSAGE_TIMEOUT = 5000;
      setTimeout(() => state.isThankYouMessageVisible = false, HIDE_THANK_YOU_MESSAGE_TIMEOUT);

      state.isChatOpened = false;
    },
    closePersonalizationForm(state) {
      state.showPersonalizationForm = false;
    },
    userTyping(state, { avatar_url, user_id, isTyping }) {
      if (isTyping) {
        state.typingUser = { avatar_url, user_id };
      } else {
        state.typingUser = null;
      }
    },
    updateMessages(state, messages) {
      state.messages = messages
    },
    updateMeta(state, newMeta) {
      const { engagementId, currentPage } = newMeta
      if (currentPage <= state.meta.currentPage) {
        return
      }

      state.meta = Object.assign({}, state.meta, newMeta)
    },
    toggleFullscreen(state) {
      state.isInFullscreen = !state.isInFullscreen;
    },
    updateClosedEngagement(state) {
      Vue.set(state.engagement, 'agent', null);
      Vue.set(state.engagement, 'assigned_to_agent', null);
      if (state.isInFullscreen) {
        state.isInFullscreen = false;
      }
    },
    SOCKET_LOGGED_INTO_SITE(state) {
      if (window.$HD && window.$HD.onClientLoggedIn instanceof Function) {
        window.$HD.onClientLoggedIn();
      }

      state.profile.is_personalized = true
    },
    SOCKET_USER_IS_TYPING(state, { avatar_url, user_id }) {
      if (user_id === state.profile.id) {
        return;
      }

      // TODO: this should be moved to actions but can't for now because of https://github.com/MetinSeylan/Vue-Socket.io/issues/99
      this.commit('userTyping', { avatar_url, user_id, isTyping: true })
      clearTimeout(this.$typingTimer)
      const STOP_DISPLAYING_TYPING_NOTIFICATION = 2500
      this.$typingTimer = setTimeout(() => this.commit('userTyping', { isTyping: false }), STOP_DISPLAYING_TYPING_NOTIFICATION)
    },
    SOCKET_UPDATE_ENGAGEMENT(state, engagement) {
      state.engagement = engagement;

      if (!state.unreadMessagesCount) {
        state.unreadMessagesCount = engagement && engagement.unread_messages_count || 0;
      }

      if (state.isChatOpened) {
        this.commit('resetUnreadMessagesCount');
      }
    },
    SOCKET_ENGAGEMENT_CLOSED(state, { engagement_id, closedBy }) {
      if (!state.engagement.id || engagement_id !== state.engagement.id) {
        return;
      }

      state.isThankYouMessageVisible = true;
      state.shouldDisplayIdentificationThankYouMessage = state.isCustomerPersonalized;

      if (closedBy === enums.USER_ROLE.CUSTOMER_SUPPORT) {
        Vue.set(state.engagement, 'isClosedByAgent', true);
        this.commit('updateClosedEngagement');
        return;
      }

      state.isChatOpened = false;
      this.commit('resetEngagement');

      this.commit('resetUnreadMessagesCount');
    },
    SOCKET_CUSTOMER_REQUEST_TIMEDOUT(state, data) {
      Vue.set(state.engagement, 'isClosedWithTimedOut', true);
      this.commit('updateClosedEngagement');

      state.messages.push(data);

      if (state.isChatOpened) {
        this.commit('resetUnreadMessagesCount');
      } else {
        this.commit('incrementUnreadMessagesCount');
      }
    },
    SOCKET_PROFILE(state, data) {
      state.profile = data;
      state.isCustomerPersonalized = data.is_personalized;
      Vue.$localStorage.init(data.name);
      Vue.$sessionStorage.init(data.name);
    },
    SOCKET_GREETING_MESSAGE(state, message) {
      state.greetingMessage = message;
    },
    SOCKET_NEW_MESSAGE(state, data) {
      if (!state.engagement.id) {
        return;
      }

      // TODO: should be properly filtered for each type of message, per separate stores
      if (data.message_type === enums.MESSAGE_TYPE.SURVEY && !data.survey.is_sent_by_agent) {
        return;
      }

      const mIndex = state.messages.findIndex(m => (data.uid && m.uid === data.uid) || (data.id && m.id === data.id));

      if (mIndex > -1) {
        Vue.set(state.messages, mIndex, Object.assign({}, state.messages[mIndex], data));
      } else {
        let position = state.messages.length;
        for (const index in state.messages) {
          const msg = state.messages[index];

          if (typeof msg.posted_at === 'undefined' || typeof data.posted_at === 'undefined') {
            break;
          }

          if (msg.posted_at > data.posted_at) {
            position = index;
            break;
          }
        }

        state.messages.splice(position, 0, data);
      }

      state.typingUser = null;

      const messageShouldBeShown = isMessageShouldBeShown(data);

      if (state.isChatOpened) {
        this.commit('resetUnreadMessagesCount');
      } else if (messageShouldBeShown
        && data.message_type !== enums.MESSAGE_TYPE.BOT
        && state.profile.id !== data.from.id) {
        this.commit('incrementUnreadMessagesCount');
      }
    },
    SOCKET_SITE_CUSTOMER_PROFILE_UPDATE_SUCCESS(state, data) {
      state.profile = {
        id: data.id,
        name: data.name,
        is_personalized: data.is_personalized,
      };

      state.isCustomerPersonalized = data.is_personalized;
      state.messages = state.messages.map(function (message) {
        if (message.from.id === data.id) {
          message.from.name = data.name;
        }

        return message;
      });

      this.commit('closePersonalizationForm');
    },
    SOCKET_SITE_CUSTOMER_PROFILE_UPDATE_FAILED(state) {
      this.commit('closePersonalizationForm')
    },
    CLEAR_OUTDATED_HISTORY(state) {
      const MAX_LIVE_TIME = 1000 * 60 * 60 * 2; // 2 hours

      const isMsgOutdated = msg => differenceInMilliseconds(new Date(), msg.posted_at) > MAX_LIVE_TIME;
      const isMsgInCurrentEngagement = msg => msg.case_id === state.engagement.id;

      const isCurrentEngagementClosed = state.engagement.state === enums.CASE_STATE.SOLVED || state.engagement.isClosedByAgent;

      const filteredMessages = state.messages.filter(msg => {
        return (!isCurrentEngagementClosed && isMsgInCurrentEngagement(msg)) || !isMsgOutdated(msg);
      });

      if (!filteredMessages.length) {
        this.commit('closeChat');
        this.commit('resetEngagement');
        return;
      }

      // TODO: remove this after infinite scroll bug fix (pin-scroll directive)
      if (filteredMessages.length < state.messages.length) {
        state.messages = filteredMessages;
      }
    },
  },
});
