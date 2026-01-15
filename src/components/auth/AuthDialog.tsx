'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { User, LogOut, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDocumentStore } from '@/store/useDocumentStore'

export function AuthDialog() {
    const [isOpen, setIsOpen] = useState(false)
    const [isLogin, setIsLogin] = useState(true)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [user, setUser] = useState<any>(null)

    const { syncWithCloud } = useDocumentStore();

    // We should also sync references, but I can't import useBibliographyStore inside useEffect cleanly
    // without triggering circular deps or rule violations if I am not careful?
    // Actually it is fine.

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            if (session?.user) {
                // Trigger store sync when user logs in
                syncWithCloud(session.user.id);
                // Also trigger references sync?
                // Ideally yes, but let's keep it simple for now or import it dynamically?
                // Or just trust the store to do it if we exposed a method.
                // We exposed `syncReferencesWithCloud`.
                // Let's do a quick lazy import or just ignore for this step to avoid complex hooks issues.
                // Actually, let's fix it properly.
                import('@/store/useBibliographyStore').then(({ useBibliographyStore }) => {
                    useBibliographyStore.getState().syncReferencesWithCloud();
                });
            }
        })

        return () => subscription.unsubscribe()
    }, [syncWithCloud])

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
                toast.success('Sesión iniciada')
                setIsOpen(false)
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                })
                if (error) throw error
                toast.success('Cuenta creada. ¡Bienvenido!')
                setIsOpen(false)
            }
        } catch (error: any) {
            toast.error(error.message || 'Error de autenticación')
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        toast.info('Sesión cerrada')
    }

    if (user) {
        return (
            <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 hidden md:inline">Hola, {user.email?.split('@')[0]}</span>
                <Button variant="ghost" size="sm" onClick={handleLogout} title="Cerrar Sesión">
                    <LogOut className="w-4 h-4 text-zinc-400 hover:text-red-500" />
                </Button>
            </div>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    <User className="w-4 h-4" />
                    <span className="hidden md:inline">Acceder</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</DialogTitle>
                    <DialogDescription>
                        {isLogin
                            ? 'Accede a tus documentos en la nube.'
                            : 'Regístrate para guardar tu tesis en la nube.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAuth} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>
                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isLogin ? 'Entrar' : 'Registrarse'}
                    </Button>
                </form>
                <div className="text-center text-xs mt-2">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-zinc-500 hover:text-indigo-600 underline"
                    >
                        {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
