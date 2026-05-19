import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUpdateProfile, useChangePassword } from '../hooks/useUsers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ProfilePage() {
  const { user, setUser } = useAuth()

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
  })
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)

  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault()
    setProfileMsg(null)
    setProfileError(null)
    try {
      const updated = await updateProfile.mutateAsync(profileForm)
      setUser(updated)
      setProfileMsg('Cambios guardados.')
    } catch {
      setProfileError('Error al guardar los cambios.')
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    setPwError(null)

    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError('Las contraseñas no coinciden.')
      return
    }
    if (pwForm.newPassword.length < 6) {
      setPwError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }

    try {
      await changePassword.mutateAsync({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      })
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
      setPwMsg('Contraseña actualizada.')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setPwError(
        status === 401
          ? 'La contraseña actual es incorrecta.'
          : 'Error al actualizar la contraseña.',
      )
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información personal</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ''} disabled />
            </div>
            <div className="grid gap-1.5">
              <Label>Nombre *</Label>
              <Input
                value={profileForm.firstName}
                onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })}
                disabled={updateProfile.isPending}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Apellido *</Label>
              <Input
                value={profileForm.lastName}
                onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })}
                disabled={updateProfile.isPending}
              />
            </div>
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}
            {profileMsg && <p className="text-sm text-green-600">{profileMsg}</p>}
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Contraseña actual *</Label>
              <Input
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                disabled={changePassword.isPending}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nueva contraseña *</Label>
              <Input
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                disabled={changePassword.isPending}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Confirmar contraseña *</Label>
              <Input
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                disabled={changePassword.isPending}
              />
            </div>
            {pwError && <p className="text-sm text-destructive">{pwError}</p>}
            {pwMsg && <p className="text-sm text-green-600">{pwMsg}</p>}
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
