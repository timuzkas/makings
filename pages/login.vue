<script setup lang="ts">
const mode = ref<'login' | 'register'>('login')
const handle = ref('')
const name = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true

  try {
    const response = await $fetch<{ user: { handle: string } }>(`/api/auth/${mode.value}`, {
      method: 'POST',
      body: {
        handle: handle.value,
        name: name.value,
        password: password.value
      }
    })

    await navigateTo(`/space/${response.user.handle}?mode=edit`)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'auth failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="page page-auth">
    <form class="auth-panel" @submit.prevent="submit">
      <div class="auth-tabs">
        <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">login</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">register</button>
      </div>

      <input v-model="handle" autocomplete="username" placeholder="handle" required />
      <input v-if="mode === 'register'" v-model="name" autocomplete="name" placeholder="display name" />
      <input v-model="password" autocomplete="current-password" placeholder="password" required type="password" />
      <button type="submit">{{ loading ? '...' : mode }}</button>
      <p v-if="error">{{ error }}</p>
    </form>
  </main>
</template>
