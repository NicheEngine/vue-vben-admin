import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mingcute:plugin-2-line',
      keepAlive: true,
      order: 1100,
      title: $t('examples.plugins.title'),
    },
    name: 'Plugins',
    path: '/plugins',
    children: [
      {
        name: 'CesiumPluginExample',
        path: 'cesium',
        component: () => import('#/views/plugins/cesium-plugin/index.vue'),
        meta: {
          icon: 'simple-icons:cesium',
          title: $t('examples.plugins.cesium'),
        },
      },
      {
        name: 'TiandituPluginExample',
        path: 'tianditu',
        component: () => import('#/views/plugins/tianditu-plugin/index.vue'),
        meta: {
          icon: 'mdi:map',
          title: $t('examples.plugins.tianditu'),
        },
      },
      {
        name: 'LivePlayerPluginExample',
        path: 'live-player',
        component: () => import('#/views/plugins/live-player-plugin/index.vue'),
        meta: {
          icon: 'mdi:video-outline',
          title: $t('examples.plugins.livePlayer'),
        },
      },
      {
        name: 'EasyPlayerPluginExample',
        path: 'easy-player',
        component: () => import('#/views/plugins/easy-player-plugin/index.vue'),
        meta: {
          icon: 'mdi:play-circle-outline',
          title: $t('examples.plugins.easyPlayer'),
        },
      },
      {
        name: 'JessibucaPluginExample',
        path: 'jessibuca',
        component: () =>
          import('#/views/plugins/jessibuca-player-plugin/index.vue'),
        meta: {
          icon: 'mdi:movie-play-outline',
          title: $t('examples.plugins.jessibuca'),
        },
      },
    ],
  },
];

export default routes;
