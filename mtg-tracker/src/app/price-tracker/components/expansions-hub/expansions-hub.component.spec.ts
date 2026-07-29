import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ExpansionsHubComponent } from './expansions-hub.component';

describe('ExpansionsHubComponent', () => {
  let component: ExpansionsHubComponent;
  let fixture: ComponentFixture<ExpansionsHubComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ExpansionsHubComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpansionsHubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
