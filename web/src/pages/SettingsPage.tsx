import { t, type MessageKey } from '../i18n'
import type { ReactNode } from 'react'

import { wakeLockSupported } from '../lib/useWakeLock'
import { OpenOnPhone } from '../components/OpenOnPhone'
import { DEV_BUILD } from '../lib/devBuild'
import { GLOBAL_HOTKEYS, isDesktop, toggleOverlay } from '../lib/desktop'
import { SettingsCard } from '../components/SettingsCard'
import { SoundSettings } from '../components/SoundSettings'
import { openSettingsCard } from '../lib/settingsCards'
import { FeaturePreview } from '../components/FeaturePreview'
import { FieldIcon, type FieldIconName } from '../components/FieldIcon'
import { setPanel } from '../lib/uiPanels'
import { Switch, Toggle } from '../components/FormControls'
import { setFlightOnMap, setFlightStyle, useFlightOnMap, useFlightStyle } from '../lib/animation'
import { setFeature, useFeature } from '../lib/features'
import { setMotion, useMotion, type MotionKind } from '../lib/motion'

interface SettingsPageProps {
  gridInput: boolean
  onGridInputChange: (value: boolean) => void
  mapInput: boolean
  onMapInputChange: (value: boolean) => void
  showMarkers: boolean
  onShowMarkersChange: (value: boolean) => void
  showScreenMarkers: boolean
  onShowScreenMarkersChange: (value: boolean) => void
  keepAwake: boolean
  onKeepAwakeChange: (value: boolean) => void
}

/** A settings section (collapsible): an icon, a title, a description and rows with dividers. */
function Card({
  id,
  icon,
  title,
  description,
  defaultOpen,
  children,
}: {
  id: string
  icon: FieldIconName
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <SettingsCard id={id} icon={icon} title={title} description={description} defaultOpen={defaultOpen}>
      <div className="mt-3 divide-y divide-app-border [&>*]:py-3.5 [&>*:first-child]:pt-1 [&>*:last-child]:pb-0">
        {children}
      </div>
    </SettingsCard>
  )
}

export function SettingsPage({
  gridInput,
  onGridInputChange,
  mapInput,
  onMapInputChange,
  showMarkers,
  onShowMarkersChange,
  showScreenMarkers,
  onShowScreenMarkersChange,
  keepAwake,
  onKeepAwakeChange,
}: SettingsPageProps) {
  const adjust = useFeature('adjust')
  const weather = useFeature('weather')
  const tot = useFeature('tot')
  const mrsi = useFeature('mrsi')
  const journal = useFeature('journal')
  const table = useFeature('table')
  const hints = useFeature('hints')
  const hideUnfit = useFeature('hideUnfit')
  const volley = useFeature('volley')
  const onlyGood = useFeature('onlyGood')
  const usageStats = useFeature('usageStats')
  const flightStyle = useFlightStyle()
  const motionNumbers = useMotion('numbers')
  const motionSwitches = useMotion('switches')
  const motionAppear = useMotion('appear')
  const motionSmooth = useMotion('smooth')
  const motionFire = useMotion('fire')
  const motionImpact = useMotion('impact')
  const flightOnMap = useFlightOnMap()

  const sections: { id: string; icon: FieldIconName; title: string }[] = [
    { id: 'settings-physics', icon: 'wind', title: t('settings.physics-section') },
    { id: 'settings-calc', icon: 'charge', title: t('settingsPage.calculator-sections') },
    { id: 'settings-map', icon: 'map', title: t('settings.map-section') },
    { id: 'settings-main', icon: 'settings', title: t('settings.preferences') },
    { id: 'settings-motion', icon: 'fire', title: t('settingsPage.animations') },
    { id: 'settings-sound', icon: 'sound', title: t('soundSettings.sounds') },
    ...(isDesktop ? [{ id: 'settings-desktop', icon: 'desktop' as FieldIconName, title: t('settings.desktop') }] : []),
    { id: 'settings-phone', icon: 'link', title: t('settings.openOnPhone') },
  ]

  return (
    <section className="space-y-4">
      {/* A quick jump to a section: on a phone the page is long */}
      <nav aria-label={t('settings.jump')} className="flex flex-wrap gap-1.5">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            onClick={(event) => {
              // The section opens, scrolling goes without an anchor in the address bar
              event.preventDefault()
              openSettingsCard(section.id)
              requestAnimationFrame(() =>
                document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              )
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-app-raised px-2.5 py-1 text-[13px] sm:px-3 sm:py-1.5 sm:text-[13.5px] font-medium text-app-text-2 transition-colors hover:bg-app-raised-hover hover:text-app-text"
          >
            <FieldIcon name={section.icon} className="h-4 w-4" />
            {section.title}
          </a>
        ))}
      </nav>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card id="settings-main" icon="settings" title={t('settings.preferences')} description={t('settings.autoSave')}>
            <div>
              <FeaturePreview id="keepAwake">
              <Switch
                checked={keepAwake}
                onChange={onKeepAwakeChange}
                disabled={!wakeLockSupported}
                label={t('settings.keepAwake')}
                description={
                  wakeLockSupported
                    ? t('settings.keepAwakeDescription')
                    : t('settings.keepAwakeUnsupported')
                }
              />
              </FeaturePreview>
            </div>

            <div>
              <Switch
                checked={hints}
                onChange={(v) => setFeature('hints', v)}
                label={t('settingsPage.hints')}
                description={
                  t('settingsPage.explanatory-notes-and-the-demos')
                }
              />
            </div>

            <div>
              <Switch
                checked={usageStats}
                onChange={(v) => setFeature('usageStats', v)}
                label={t('settings.usage-stats')}
                description={t('settings.usage-stats-description')}
              />
            </div>

          </Card>

          <Card
            id="settings-motion"
            icon="fire"
            title={t('settingsPage.animations')}
            description={t('settingsPage.shell-flight-and-impact-after')}
          >
            <div className="space-y-4">
              {(
                [
                  ['numbers', motionNumbers, 'settingsPage.motion-numbers', 'settingsPage.motion-numbers-description'],
                  ['switches', motionSwitches, 'settingsPage.motion-switches', 'settingsPage.motion-switches-description'],
                  ['appear', motionAppear, 'settingsPage.motion-appear', 'settingsPage.motion-appear-description'],
                  ['smooth', motionSmooth, 'settingsPage.motion-smooth', 'settingsPage.motion-smooth-description'],
                  ['fire', motionFire, 'settingsPage.motion-fire', 'settingsPage.motion-fire-description'],
                  ['impact', motionImpact, 'settingsPage.motion-impact', 'settingsPage.motion-impact-description'],
                ] as [MotionKind, boolean, MessageKey, MessageKey][]
              ).map(([kind, on, label, description]) => (
                <Switch
                  key={kind}
                  checked={on}
                  onChange={(value) => setMotion(kind, value)}
                  label={t(label)}
                  description={t(description)}
                />
              ))}
              <p className="text-[12.5px] text-app-faint">{t('settingsPage.motion-always')}</p>
              <p className="label text-app-faint">{t('settingsPage.shot-animation')}</p>
              <Toggle
                label={t('settingsPage.animation-style')}
                value={flightStyle}
                onChange={setFlightStyle}
                options={[
                  { value: 'off', label: t('settingsPage.off') },
                  { value: 'minimal', label: t('settingsPage.minimal') },
                  { value: 'detailed', label: t('settingsPage.detailed') },
                ]}
              />
              <Switch
                checked={flightOnMap}
                onChange={setFlightOnMap}
                disabled={flightStyle === 'off'}
                label={t('settingsPage.show-on-the-map')}
                description={
                  t('settingsPage.the-shell-flies-from-the')
                }
              />
            </div>
          </Card>

          <SoundSettings />

          {isDesktop && (
            <Card id="settings-desktop" icon="desktop" title={t('settings.desktop')} description={t('settings.desktopDescription')}>
              <div>
              <button
                type="button"
                onClick={() => void toggleOverlay()}
                className="btn btn-primary mt-4"
              >
                {t('settings.toggleOverlay')}
              </button>

              <dl className="mt-4 divide-y divide-app-border overflow-hidden rounded-lg text-sm">
                {GLOBAL_HOTKEYS.map(({ keys, action }) => (
                  <div
                    key={action}
                    className="flex items-baseline gap-3 bg-app-raised px-3 py-2"
                  >
                    <dt className="min-w-32">
                      <kbd className="kbd">{keys}</kbd>
                    </dt>
                    <dd className="text-app-muted">{t(`settings.hotkeys.${action}` as MessageKey)}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 rounded-md bg-app-raised px-3 py-2 text-xs text-app-muted">
                {t('settings.armaDisplayMode')}
              </p>
              </div>
            </Card>
          )}

          <Card
            id="settings-phone"
            icon="link"
            title={t('settings.openOnPhone')}
            description={t('settings.openOnPhoneDescription')}
          >
            <div>
              <OpenOnPhone />
            </div>
          </Card>
        </div>

        <div className="order-first flex flex-col gap-4">
          {/* The main thing for accuracy: does the server have shell physics */}
          <Card
            id="settings-physics"
            icon="wind"
            title={t('settings.physics-section')}
            description={t('settings.physics-why')}
            defaultOpen
          >
              <FeaturePreview id="weather">
              <Switch
                checked={weather}
                onChange={(v) => setFeature('weather', v)}
                label={t('settingsPage.weather-ballistics')}
                description={t('settingsPage.weather-ballistics-description')}
              />
              <button
                type="button"
                onClick={() => setPanel('physics', true)}
                className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-accent hover:underline"
              >
                <FieldIcon name="help" className="h-4 w-4" />
                {t('physics.check')}
              </button>
              </FeaturePreview>
          </Card>

          <Card
            id="settings-calc"
            icon="charge"
            title={t('settingsPage.calculator-sections')}
            description={t('settingsPage.turn-on-only-what-you')}
          >
              <FeaturePreview id="adjust">
              <Switch
                checked={adjust}
                onChange={(v) => setFeature('adjust', v)}
                label={t('adjustFire.adjust-fire')}
                description={
                  t('settingsPage.short-over-left-right-reports')
                }
              />
              </FeaturePreview>
              <FeaturePreview id="tot">
              <Switch
                checked={tot}
                onChange={(v) => setFeature('tot', v)}
                label={t('totPanel.time-on-target')}
                description={
                  t('settingsPage.set-the-impact-time-and')
                }
              />
              </FeaturePreview>
              <FeaturePreview id="mrsi">
              <Switch
                checked={mrsi}
                onChange={(v) => setFeature('mrsi', v)}
                label={t('mrsiPanel.simultaneous-impact-mrsi')}
                description={t('settingsPage.mrsi-description')}
              />
              </FeaturePreview>
              <FeaturePreview id="table">
              <Switch
                checked={table}
                onChange={(v) => setFeature('table', v)}
                label={t('ballisticTableView.in-game-range-table')}
                description={
                  t('settingsPage.the-elevation-by-range-table')
                }
              />
              </FeaturePreview>
              <Switch
                checked={volley}
                onChange={(v) => setFeature('volley', v)}
                label={t('settingsPage.volley')}
                description={t('settingsPage.volley-description')}
              />
              <Switch
                checked={onlyGood}
                onChange={(v) => setFeature('onlyGood', v)}
                label={t('settingsPage.only-good')}
                description={t('settingsPage.only-good-description')}
              />
              <Switch
                checked={hideUnfit}
                onChange={(v) => setFeature('hideUnfit', v)}
                label={t('settingsPage.hide-unfit')}
                description={t('settingsPage.hide-unfit-description')}
              />
              <FeaturePreview id="journal">
              <Switch
                checked={journal}
                onChange={(v) => setFeature('journal', v)}
                label={t('settingsPage.target-journal')}
                description={
                  t('settingsPage.saving-targets-the-quick-list')
                }
              />
              </FeaturePreview>
          </Card>

          <Card
            id="settings-map"
            icon="map"
            title={t('settings.map-section')}
            description={t('settings.map-description')}
          >
              <FeaturePreview id="map">
              <Switch
                checked={mapInput}
                onChange={onMapInputChange}
                label={t('settings.mapInput')}
                description={t('settings.mapInputDescription')}
              />
              </FeaturePreview>
              <FeaturePreview id="markers">
              <Switch
                checked={showMarkers}
                onChange={onShowMarkersChange}
                label={t('settingsPage.map-markers')}
                description={
                  t('settingsPage.the-markers-panel-the-marker')
                }
              />
              </FeaturePreview>
              {/* Experimental features: only in the development build */}
              {DEV_BUILD && (
              <>
              <FeaturePreview id="screenMarkers">
              <Switch
                checked={showScreenMarkers}
                onChange={onShowScreenMarkersChange}
                label={t('screenMarkers.markers-from-the-game-screen')}
                description={
                  t('settingsPage.recognise-markers-on-a-game')
                }
                disabled={!showMarkers}
              />
              </FeaturePreview>
              <FeaturePreview id="grid">
              <Switch
                checked={gridInput}
                onChange={onGridInputChange}
                label={t('settings.gridInput')}
                description={t('settings.gridInputDescription')}
              />
              </FeaturePreview>
              </>
              )}
          </Card>
        </div>
      </div>
    </section>
  )
}
