import { _decorator, Component, AudioClip, AudioSource } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AudioMgr')
export class AudioMgr extends Component {
    static instance: AudioMgr = null;
    @property({ type: AudioClip, tooltip: '射击音' }) shootClip: AudioClip = null;
    @property({ type: AudioClip, tooltip: '玩家受击音' }) hurtClip: AudioClip = null;
    @property({ type: AudioClip, tooltip: '敌人死亡音' }) enemyDieClip: AudioClip = null;
    @property({ type: AudioClip, tooltip: '升级音' }) levelUpClip: AudioClip = null;
    @property({ type: AudioClip, tooltip: '背景音乐' }) bgmClip: AudioClip = null;
    // 两个喇叭，各干各的：
    private _sfx: AudioSource = null;   // 音效喇叭，playOneShot 能叠加播放
    private _bgm: AudioSource = null;   // 音乐喇叭，loop 循环

    protected onLoad(): void {
        AudioMgr.instance = this;

        // 音效喇叭
        this._sfx = this.getComponent(AudioSource) ?? this.addComponent(AudioSource);
        this._sfx.loop = false;
        // 音乐喇叭：独立一个，BGM 循环永远不会被音效打断
        this._bgm = this.addComponent(AudioSource);
        this._bgm.loop = true;
        this._bgm.clip = this.bgmClip;
        this._bgm.volume = 0.22;
        if (this.bgmClip) this._bgm.play(); // 开局自动放


    }
    protected onDestroy(): void {
        if (AudioMgr.instance === this) AudioMgr.instance = null;
    }

    private play(clip: AudioClip, vol = 0.6): void {
        if (!clip) return;
        this._sfx.playOneShot(clip, vol);
    }

    playShoot() { this.play(this.shootClip, 0.35); }   // 射击最频繁，音量最低
    playHurt() { this.play(this.hurtClip, 0.6); }
    playEnemyDie() { this.play(this.enemyDieClip, 0.5); }
    playLevelUp() { this.play(this.levelUpClip, 0.7); }
    // 停掉 BGM（游戏结束时调用）
    stopBgm() {
        if (this._bgm) this._bgm.stop()   
    }


}